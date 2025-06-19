import { GridApi } from "../types";
import { Column } from "../types";
import { RowNode } from "../types";
import { Parser, Expression } from "expr-eval";

/**
 * 层级公式配置类型定义
 */
export interface LevelFormula {
    level?: number; // 特定层级，如果不指定则为默认公式
    formula: string; // 该层级使用的公式
    isLeaf?: boolean; // 是否是叶子节点专用公式
}

/**
 * 扩展的列定义，支持多层级公式
 */
export interface ColumnWithLevelFormulas extends Column {
    formula?: string; // 向后兼容的单一公式
    levelFormulas?: LevelFormula[]; // 多层级公式定义
}

/**
 * 计算项，用于表示一个需要计算的节点字段
 */
interface CalculationItem {
    node: RowNode;
    field: string;
}

/**
 * FormulaManager - 负责解析和计算基于字符串的公式，并管理它们之间的依赖关系。
 */
export class FormulaManager {
    private gridApi: GridApi;
    private parser: Parser;

    // 存储每个计算列的公式信息
    private formulaMap: Map<string, { formula: string; parsed: Expression; dependencies: string[] }> = new Map();

    // 存储层级公式信息
    private levelFormulaMap: Map<string, Map<number, { formula: string; parsed: Expression; dependencies: string[]; isLeaf?: boolean }>> = new Map();

    // 字段依赖图
    private dependencyGraph: Map<string, Set<string>> = new Map();

    constructor(api: GridApi) {
        this.gridApi = api;
        this.parser = new Parser({
            allowMemberAccess: false,
        });
        this.registerCustomFunctions();
    }

    /**
     * 注册自定义的聚合函数
     */
    private registerCustomFunctions(): void {
        // 汇总所有子级数据（递归所有层级）
        this.parser.functions.SUMALL = (arr: any[], prop: string) => {
            if (!Array.isArray(arr)) return 0;
            
            // 递归函数，用于计算节点及其所有子孙节点的总和
            const recursiveSum = (nodes: any[]): number => {
                if (!nodes || !nodes.length) return 0;
                
                return nodes.reduce((sum, node) => {
                    // 当前节点的值
                    const currentValue = Number(node[prop] || 0);
                    // 子节点的值之和（递归计算）
                    const childrenSum = node.children && node.children.length ? 
                        recursiveSum(node.children) : 0;
                    
                    return sum + currentValue + childrenSum;
                }, 0);
            };
            
            // 只计算传入数组中的直接子节点和它们的子孙节点，不包括传入节点自身
            return arr.reduce((acc, item) => {
                // 当前节点的值
                const nodeValue = Number(item[prop] || 0);
                // 子孙节点的值（如果有）
                const descendantsValue = item.children && item.children.length ? 
                    recursiveSum(item.children) : 0;
                    
                return acc + nodeValue + descendantsValue;
            }, 0);
        };

        // 只汇总直接子级数据（一层）
        this.parser.functions.SUM = (arr: any[], prop: string) => {
            if (!Array.isArray(arr)) return 0;
            // 直接计算所有子节点的总和，不需要过滤
            return arr.reduce((acc, item) => acc + Number(item[prop] || 0), 0);
        };

        // 计算所有子级平均值（递归所有层级）
        this.parser.functions.AVGALL = (arr: any[], prop: string) => {
            if (!Array.isArray(arr) || arr.length === 0) return 0;
            
            // 递归收集所有节点
            const collectAllNodes = (nodes: any[]): any[] => {
                if (!nodes || !nodes.length) return [];
                
                return nodes.reduce((allNodes, node) => {
                    // 添加当前节点
                    allNodes.push(node);
                    // 添加子节点（递归）
                    if (node.children && node.children.length) {
                        allNodes.push(...collectAllNodes(node.children));
                    }
                    return allNodes;
                }, []);
            };
            
            // 收集所有节点
            const allNodes = collectAllNodes(arr);
            // 计算总和
            const sum = allNodes.reduce((acc, item) => acc + Number(item[prop] || 0), 0);
            // 返回平均值
            return sum / allNodes.length;
        };

        // 只计算直接子级平均值
        this.parser.functions.AVG = (arr: any[], prop: string) => {
            if (!Array.isArray(arr) || arr.length === 0) return 0;
            
            // 直接计算所有直接子节点的平均值，不需要过滤
            const sum = arr.reduce((acc, item) => acc + Number(item[prop] || 0), 0);
            return sum / arr.length;
        };

        this.parser.functions.COUNT = (arr: any[]) => {
            return Array.isArray(arr) ? arr.length : 0;
        };

        // 递归计算所有子孙节点的数量
        this.parser.functions.COUNTALL = (arr: any[]) => {
            if (!Array.isArray(arr)) return 0;
            
            // 递归函数，用于计算节点及其所有子孙节点的数量
            const recursiveCount = (nodes: any[]): number => {
                if (!nodes || !nodes.length) return 0;
                
                return nodes.reduce((count, node) => {
                    // 子节点的数量（递归计算）
                    const childrenCount = node.children && node.children.length ? 
                        recursiveCount(node.children) : 0;
                    
                    return count + 1 + childrenCount; // 1是当前节点
                }, 0);
            };
            
            return recursiveCount(arr);
        };

        // 条件函数
        this.parser.functions.IF = (condition: boolean, trueValue: any, falseValue: any) => {
            return condition ? trueValue : falseValue;
        };
        
        // 节点类型判断
        this.parser.functions.ISLEAF = (context: any = {}) => {
            return !context.hasChildren;
        };
        
        this.parser.functions.ISROOT = (context: any = {}) => {
            return !context.hasParent;
        };
        
        this.parser.functions.LEVEL = (context: any = {}) => {
            return context.nodeLevel;
        };
    }

    /**
     * 设置列定义，并构建依赖图
     */
    public setColumnDefs(cols: Column[]): void {
        this.formulaMap.clear();
        this.levelFormulaMap.clear();
        this.dependencyGraph.clear();

        cols.forEach(col => {
            const columnWithLevels = col as ColumnWithLevelFormulas;
            
            // 处理标准公式（向后兼容）
            if (columnWithLevels.formula) {
                try {
                    const parsed = this.parser.parse(columnWithLevels.formula);
                    const dependencies = this.extractDependencies(parsed, columnWithLevels.formula);

                    this.formulaMap.set(col.field, {
                        formula: columnWithLevels.formula,
                        parsed: parsed,
                        dependencies: dependencies,
                    });

                    // 更新依赖图
                    this.updateDependencyGraph(col.field, dependencies);
                } catch (e) {
                    console.error(`Error parsing formula for column "${col.field}": ${columnWithLevels.formula}`, e);
                }
            }
            
            // 处理多层级公式
            if (columnWithLevels.levelFormulas && columnWithLevels.levelFormulas.length > 0) {
                const levelMap = new Map<number, { formula: string; parsed: Expression; dependencies: string[]; isLeaf?: boolean }>();
                
                // 预处理层级公式，确保有一个默认公式
                let hasDefaultFormula = false;
                
                columnWithLevels.levelFormulas.forEach(levelFormula => {
                    try {
                        const processedFormula = this.processLevelFormula(levelFormula);
                        
                        if (processedFormula.level === -1) hasDefaultFormula = true;
                        
                        levelMap.set(processedFormula.level, {
                            formula: processedFormula.formula,
                            parsed: processedFormula.parsed,
                            dependencies: processedFormula.dependencies,
                            isLeaf: processedFormula.isLeaf
                        });
                        
                        // 更新依赖图
                        this.updateDependencyGraph(col.field, processedFormula.dependencies);
                    } catch (e) {
                        console.error(`Error parsing level formula for column "${col.field}" at level ${levelFormula.level}:`, e);
                    }
                });
                
                // 如果没有默认公式，且有常规公式，则将常规公式设为默认
                if (!hasDefaultFormula && columnWithLevels.formula) {
                    const parsed = this.parser.parse(columnWithLevels.formula);
                    const dependencies = this.extractDependencies(parsed, columnWithLevels.formula);
                    
                    levelMap.set(-1, {
                        formula: columnWithLevels.formula,
                        parsed: parsed,
                        dependencies: dependencies
                    });
                }
                
                if (levelMap.size > 0) {
                    this.levelFormulaMap.set(col.field, levelMap);
                }
            }
        });
    }

    /**
     * 更新依赖图
     */
    private updateDependencyGraph(field: string, dependencies: string[]): void {
                    // 更新依赖图
                    dependencies.forEach(dep => {
                        // 简单的依赖，如 [price]
                        if (!dep.includes('.')) {
                             if (!this.dependencyGraph.has(dep)) {
                                this.dependencyGraph.set(dep, new Set());
                            }
                this.dependencyGraph.get(dep)!.add(field);
            }
        });
    }

    /**
     * 获取适用于特定节点的公式
     */
    private getApplicableFormulaForNode(node: RowNode, levelMap: Map<number, any>): any {
        // 计算当前节点级别
        let level = 0;
        let parent = node.parent;
        while (parent) {
            level++;
            parent = parent.parent;
        }
        
        // 检测是否为叶子节点
        const isLeafNode = !node.children || node.children.length === 0;
        
        console.log(`Finding formula for node ${node.id}, level: ${level}, isLeaf: ${isLeafNode}`);
        
        // 查找叶子节点专用公式
        let formulaInfo = null;
        if (isLeafNode) {
            // 查找isLeaf=true的公式
            for (const [_, info] of levelMap) {
                if (info.isLeaf) {
                    console.log(`Found leaf formula for node ${node.id}: ${info.formula}`);
                    formulaInfo = info;
                    break;
                }
            }
        }
        
        // 如果没有找到叶子节点专用公式，则按层级查找
        if (!formulaInfo) {
            formulaInfo = levelMap.get(level);
            console.log(`Level ${level} formula for node ${node.id}: ${formulaInfo ? formulaInfo.formula : 'not found'}`);
            
            // 如果没有当前层级的公式，尝试默认公式
            if (!formulaInfo) {
                formulaInfo = levelMap.get(-1); // 尝试默认公式
                console.log(`Default formula for node ${node.id}: ${formulaInfo ? formulaInfo.formula : 'not found'}`);
                
                // 如果没有默认公式，尝试最近层级的公式
                if (!formulaInfo) {
                    let nearestLevel = -1;
                    let minDistance = Infinity;
                    
                    levelMap.forEach((info, lvl) => {
                        if (lvl >= 0 && !info.isLeaf) {
                            const distance = Math.abs(lvl - level);
                            if (distance < minDistance) {
                                minDistance = distance;
                                nearestLevel = lvl;
                            }
                        }
                    });
                    
                    if (nearestLevel >= 0) {
                        formulaInfo = levelMap.get(nearestLevel);
                        console.log(`Nearest level ${nearestLevel} formula for node ${node.id}: ${formulaInfo ? formulaInfo.formula : 'not found'}`);
                    }
                }
            }
        }
        
        return formulaInfo;
    }

    /**
     * 对所有行进行完整的初始计算，使用拓扑排序
     */
    public processAllRows(): void {
        console.time('processAllRows');
        
        if (this.formulaMap.size === 0 && this.levelFormulaMap.size === 0) {
            console.timeEnd('processAllRows');
            return;
        }
        
        // 检查公式和层级公式
        const formulaFields = Array.from(this.formulaMap.keys());
        const levelFormulaFields = Array.from(this.levelFormulaMap.keys());
        console.log(`Standard formulas: ${formulaFields.join(', ')}`);
        console.log(`Level formulas: ${levelFormulaFields.join(', ')}`);
        
        // 收集所有节点和字段
        const calculationItems: CalculationItem[] = [];
        
        // 创建节点字段依赖图（只表示字段间依赖，不包括节点间依赖）
        const fieldDependencyGraph = new Map<string, Set<string>>();
        
        // 从标准公式填充依赖图
        this.formulaMap.forEach((formulaInfo, field) => {
            fieldDependencyGraph.set(field, new Set());
            formulaInfo.dependencies.forEach(dep => {
                if (!dep.includes('.')) { // 仅考虑同行字段依赖
                    if (!fieldDependencyGraph.has(dep)) {
                        fieldDependencyGraph.set(dep, new Set());
                    }
                    fieldDependencyGraph.get(dep)!.add(field);
                }
            });
        });
        
        // 从多层级公式填充依赖图
        this.levelFormulaMap.forEach((levelMap, field) => {
            fieldDependencyGraph.set(field, new Set());
            for (const [_, info] of levelMap) {
                info.dependencies.forEach(dep => {
                    if (!dep.includes('.')) { // 仅考虑同行字段依赖
                        if (!fieldDependencyGraph.has(dep)) {
                            fieldDependencyGraph.set(dep, new Set());
                        }
                        fieldDependencyGraph.get(dep)!.add(field);
                    }
                });
            }
        });
        
        // 计算字段拓扑顺序
        const fieldOrder = this.topologicalSortFields(fieldDependencyGraph);
        console.log(`Field calculation order: ${fieldOrder.join(' -> ')}`);
        
        // 为所有节点和相关字段创建计算项
        this.gridApi.forEachNode(node => {
            // 处理标准公式
            this.formulaMap.forEach((_, field) => {
                calculationItems.push({ node, field });
            });
            
            // 处理多层级公式
            this.levelFormulaMap.forEach((_, field) => {
                calculationItems.push({ node, field });
            });
        });
        
        // 排序计算项，先按照字段的依赖顺序，再按照节点层级（从叶子节点到根节点）
        calculationItems.sort((a, b) => {
            // 先按字段依赖顺序排序
            const aIdx = fieldOrder.indexOf(a.field);
            const bIdx = fieldOrder.indexOf(b.field);
            
            if (aIdx !== bIdx) return aIdx - bIdx;
            
            // 字段相同时，按层级排序（子节点先于父节点）
            const aLevel = this.getNodeLevel(a.node);
            const bLevel = this.getNodeLevel(b.node);
            
            // 层级大的节点（更深的子节点）优先计算
            return bLevel - aLevel;
        });
        
        // 按顺序计算
        let updatedCount = 0;
        
        console.log(`Starting calculations for ${calculationItems.length} items`);
        
        for (const { node, field } of calculationItems) {
            // 处理标准公式
            if (this.formulaMap.has(field)) {
                if (this.updateNode(node, field)) {
                    updatedCount++;
                }
            }
            
            // 处理多层级公式
            if (this.levelFormulaMap.has(field)) {
                if (this.updateNodeWithLevelFormula(node, field)) {
                    updatedCount++;
                }
            }
        }
        
        console.log(`Updated ${updatedCount} values`);
        console.timeEnd('processAllRows');
    }
    
    /**
     * 获取节点级别（0表示根节点）
     */
    private getNodeLevel(node: RowNode): number {
        let level = 0;
        let parent = node.parent;
        while (parent) {
            level++;
            parent = parent.parent;
        }
        return level;
    }
    
    /**
     * 对字段进行拓扑排序，确保依赖字段在被依赖字段之前计算
     */
    private topologicalSortFields(graph: Map<string, Set<string>>): string[] {
        // 计算每个字段的入度（被依赖数）
        const inDegree = new Map<string, number>();
        
        // 初始化所有字段的入度为0
        for (const field of graph.keys()) {
            inDegree.set(field, 0);
        }
        
        // 计算每个字段的入度
        for (const dependents of graph.values()) {
            for (const dependent of dependents) {
                inDegree.set(dependent, (inDegree.get(dependent) || 0) + 1);
            }
        }
        
        // 找出所有入度为0的字段（无依赖的字段）
        const queue: string[] = [];
        for (const [field, degree] of inDegree) {
            if (degree === 0) {
                queue.push(field);
            }
        }
        
        const result: string[] = [];
        
        // 拓扑排序主循环
        while (queue.length > 0) {
            const current = queue.shift()!;
            result.push(current);
            
            // 更新依赖于当前字段的所有字段的入度
            const dependents = graph.get(current) || new Set();
            for (const dependent of dependents) {
                const newDegree = inDegree.get(dependent)! - 1;
                inDegree.set(dependent, newDegree);
                
                if (newDegree === 0) {
                    queue.push(dependent);
                }
            }
        }
        
        // 检查是否存在环
        if (result.length !== graph.size) {
            console.warn("Circular dependencies detected in formulas");
            
            // 尝试处理剩余的字段
            for (const [field, degree] of inDegree) {
                if (degree > 0 && !result.includes(field)) {
                    result.push(field);
                }
            }
        }
        
        return result;
    }

    /**
     * 当一个单元格的值更新后，处理所有依赖它的计算
     */
    public processUpdate(rowNode: RowNode, updatedField: string): Map<RowNode, Set<string>> {
        const updates = new Map<RowNode, Set<string>>();
        const queue: {node: RowNode, field: string}[] = [{ node: rowNode, field: updatedField }];
        const visited = new Set<string>(); // key: `${node.id}-${field}`

        while(queue.length > 0) {
            const { node, field } = queue.shift()!;
            const visitKey = `${node.id}-${field}`;

            if (visited.has(visitKey)) continue;
            visited.add(visitKey);

            // 1. 同行内的依赖更新 (向下)
            const dependents = this.dependencyGraph.get(field);
            if (dependents) {
                dependents.forEach(dependentField => {
                    // 检查是否有标准公式
                    const hasStandardFormula = this.formulaMap.has(dependentField);
                    // 检查是否有多层级公式
                    const hasLevelFormulas = this.levelFormulaMap.has(dependentField);
                    
                    let updated = false;
                    
                    // 应用标准公式
                    if (hasStandardFormula) {
                        updated = this.updateNode(node, dependentField) || updated;
                    }
                    
                    // 应用多层级公式
                    if (hasLevelFormulas) {
                        updated = this.updateNodeWithLevelFormula(node, dependentField) || updated;
                    }
                    
                    if (updated) {
                        if (!updates.has(node)) updates.set(node, new Set());
                        updates.get(node)!.add(dependentField);
                        queue.push({ node: node, field: dependentField });
                    }
                });
            }

            // 2. 对父行的聚合公式更新 (向上)
            if (node.parent) {
                // 处理标准公式
                this.formulaMap.forEach((formulaInfo, formulaField) => {
                    if (this.isChildDependent(formulaInfo.formula, field)) {
                        if (this.updateNode(node.parent!, formulaField)) {
                            if (!updates.has(node.parent!)) updates.set(node.parent!, new Set());
                            updates.get(node.parent!)!.add(formulaField);
                            queue.push({ node: node.parent!, field: formulaField });
                        }
                    }
                });
                
                // 处理层级公式
                this.levelFormulaMap.forEach((levelMap, formulaField) => {
                    levelMap.forEach(formulaInfo => {
                        if (this.isChildDependent(formulaInfo.formula, field)) {
                            if (this.updateNodeWithLevelFormula(node.parent!, formulaField)) {
                                if (!updates.has(node.parent!)) updates.set(node.parent!, new Set());
                                updates.get(node.parent!)!.add(formulaField);
                                queue.push({ node: node.parent!, field: formulaField });
                            }
                        }
                    });
                });
            }

            // 3. 对子行的父引用公式更新 (向下)
            if (node.children && node.children.length > 0) {
                // 处理标准公式
                 this.formulaMap.forEach((formulaInfo, formulaField) => {
                    if (this.isParentDependent(formulaInfo.formula, field)) {
                        node.children!.forEach(childNode => {
                            if(this.updateNode(childNode, formulaField)) {
                                if (!updates.has(childNode)) updates.set(childNode, new Set());
                                updates.get(childNode)!.add(formulaField);
                                queue.push({ node: childNode, field: formulaField });
                            }
                        });
                    }
                });
                
                // 处理层级公式
                this.levelFormulaMap.forEach((levelMap, formulaField) => {
                    levelMap.forEach(formulaInfo => {
                        if (this.isParentDependent(formulaInfo.formula, field)) {
                            node.children!.forEach(childNode => {
                                if(this.updateNodeWithLevelFormula(childNode, formulaField)) {
                                    if (!updates.has(childNode)) updates.set(childNode, new Set());
                                    updates.get(childNode)!.add(formulaField);
                                    queue.push({ node: childNode, field: formulaField });
                                }
                            });
                        }
                    });
                });
            }
        }
        
        return updates;
    }

    /**
     * 使用多层级公式更新节点
     */
    private updateNodeWithLevelFormula(node: RowNode, fieldToCompute: string): boolean {
        const levelMap = this.levelFormulaMap.get(fieldToCompute);
        if (!levelMap || levelMap.size === 0) return false;
        
        // 获取适用于当前节点的公式
        const formulaInfo = this.getApplicableFormulaForNode(node, levelMap);
        
        // 如果找不到任何适合的公式，返回false
        if (!formulaInfo) {
            console.log(`No applicable formula for node ${node.id}, field ${fieldToCompute}`);
            return false;
        }
        
        // 检测是否为叶子节点
        const isLeafNode = !node.children || node.children.length === 0;
        
        // 叶子节点处理: 如果是叶子节点且没有找到专用叶子公式，且当前公式包含子节点计算
        if (isLeafNode && !formulaInfo.isLeaf && this.containsChildAggregation(formulaInfo.formula)) {
            // 叶子节点没有子节点，使用初始值或保持不变
            return false;
        }
        
        const context = this.createContext(node);
        
        // For debugging
        if (fieldToCompute === 'stock') {
            console.log(`Evaluating ${fieldToCompute} for node ${node.id} with formula: ${formulaInfo.formula}`);
            if (context.children && context.children.length > 0) {
                console.log(`Children for node ${node.id}:`, context.children.map((c: any) => ({ stock: c.stock })));
                    }
        }
        
        const newValue = this.evaluate(formulaInfo.parsed, context);
        const oldValue = node.data[fieldToCompute];
        
        if (fieldToCompute === 'stock') {
            console.log(`Result for ${node.id}: ${oldValue} -> ${newValue}`);
        }
        
        if (newValue !== oldValue) {
            node.data[fieldToCompute] = newValue;
            return true;
        }
        return false;
    }

    private updateNode(node: RowNode, fieldToCompute: string): boolean {
        const formulaInfo = this.formulaMap.get(fieldToCompute);
        if (!formulaInfo) return false;

        const context = this.createContext(node);
        const newValue = this.evaluate(formulaInfo.parsed, context);
        const oldValue = node.data[fieldToCompute];

        if (newValue !== oldValue) {
            node.data[fieldToCompute] = newValue;
            return true;
        }
        return false;
    }

    private createContext(node: RowNode): any {
        // 计算节点级别
        let level = 0;
        let parent = node.parent;
        while (parent) {
            level++;
            parent = parent.parent;
        }
        
        // 判断节点类型
        const hasChildren = node.children && node.children.length > 0;
        const hasParent = !!node.parent;
        
        return {
            ...node.data,
            parent: node.parent ? node.parent.data : {},
            children: node.children ? node.children.map(c => c.data) : [],
            // 添加节点类型信息
            hasChildren,
            hasParent,
            nodeLevel: level,
        };
    }

    private evaluate(parsedExpression: Expression, context: any): any {
        try {
            return parsedExpression.evaluate(context);
        } catch (e) {
            console.error("Error evaluating formula:", e);
            // 公式计算出错（例如除以0），返回undefined
            return undefined;
        }
    }

    private extractDependencies(parsed: Expression, formula: string): string[] {
        // 基础依赖
        const simpleDependencies = parsed.variables();

        // 复杂依赖 (parent. & children.)
        const complexDependencies = [];
        const parentRegex = /parent\.(\w+)/g;
        const childrenRegex = /children\.(\w+)/g;
        let match;
        while(match = parentRegex.exec(formula)) {
            complexDependencies.push(match[0]);
        }
        while(match = childrenRegex.exec(formula)) {
            complexDependencies.push(match[0]);
        }
        return [...simpleDependencies, ...complexDependencies];
    }
    
    private isChildDependent(formula: string, childField: string): boolean {
        // e.g. SUM(children, 'price') and childField is 'price'
        const regex = new RegExp(`children.*${childField}`);
        return regex.test(formula);
    }
    
    private isParentDependent(formula: string, parentField: string): boolean {
         // e.g. parent.tax_rate and parentField is 'tax_rate'
        const regex = new RegExp(`parent\\.${parentField}`);
        return regex.test(formula);
    }

    /**
     * 检测公式是否包含子节点聚合函数
     */
    private containsChildAggregation(formula: string): boolean {
        // 检查是否包含SUM、AVG等子节点聚合函数
        return /SUM\s*\(\s*children/i.test(formula) || 
               /AVG\s*\(\s*children/i.test(formula) || 
               /COUNT\s*\(\s*children/i.test(formula) || 
               /SUMALL\s*\(\s*children/i.test(formula) || 
               /AVGALL\s*\(\s*children/i.test(formula) || 
               /COUNTALL\s*\(\s*children/i.test(formula);
    }

    /**
     * 在层级公式设置中添加叶子节点公式支持
     */
    private processLevelFormula(levelFormula: LevelFormula): { level: number, formula: string, parsed: Expression, dependencies: string[], isLeaf?: boolean } {
        const level = levelFormula.level ?? -1; // -1 表示默认公式
        const formula = levelFormula.formula;
        const parsed = this.parser.parse(formula);
        const dependencies = this.extractDependencies(parsed, formula);
        
        return {
            level, 
            formula,
            parsed,
            dependencies,
            isLeaf: levelFormula.isLeaf
        };
    }
} 