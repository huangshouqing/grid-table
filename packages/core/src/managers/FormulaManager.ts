import { GridApi } from "../types";
import { Column } from "../types";
import { RowNode } from "../types";
import { Parser, Expression } from "expr-eval";

/**
 * FormulaManager - 负责解析和计算基于字符串的公式，并管理它们之间的依赖关系。
 */
export class FormulaManager {
    private gridApi: GridApi;
    private parser: Parser;

    // 存储每个计算列的公式信息
    // key: field of the calculated column
    // value: { formula: string, parsed: Expression, dependencies: string[] }
    private formulaMap: Map<string, { formula: string; parsed: Expression; dependencies: string[] }> = new Map();

    // 存储依赖关系图
    // key: a field that other fields depend on (e.g., 'price')
    // value: a Set of fields that depend on the key (e.g., {'total', 'discounted_price'})
    private dependencyGraph: Map<string, Set<string>> = new Map();

    constructor(api: GridApi) {
        this.gridApi = api;
        this.parser = new Parser({
            // 允许公式引用不存在的字段，它们的值会是 undefined
            // 这在处理例如 `[optional_field] * 10` 时很有用
            allowMemberAccess: false,
        });
        this.registerCustomFunctions();
    }

    /**
     * 注册自定义的聚合函数
     */
    private registerCustomFunctions(): void {
        this.parser.functions.SUM = (arr: any[], prop: string) => {
            if (!Array.isArray(arr)) return 0;
            return arr.reduce((acc, item) => acc + (item[prop] || 0), 0);
        };

        this.parser.functions.AVG = (arr: any[], prop: string) => {
            if (!Array.isArray(arr) || arr.length === 0) return 0;
            const sum = arr.reduce((acc, item) => acc + (item[prop] || 0), 0);
            return sum / arr.length;
        };

        this.parser.functions.COUNT = (arr: any[]) => {
            return Array.isArray(arr) ? arr.length : 0;
        };
    }

    /**
     * 设置列定义，并构建依赖图
     */
    public setColumnDefs(cols: Column[]): void {
        this.formulaMap.clear();
        this.dependencyGraph.clear();

        cols.forEach(col => {
            if (col.formula) {
                try {
                    const parsed = this.parser.parse(col.formula);
                    const dependencies = this.extractDependencies(parsed, col.formula);

                    this.formulaMap.set(col.field, {
                        formula: col.formula,
                        parsed: parsed,
                        dependencies: dependencies,
                    });

                    // 更新依赖图
                    dependencies.forEach(dep => {
                        // 简单的依赖，如 [price]
                        if (!dep.includes('.')) {
                             if (!this.dependencyGraph.has(dep)) {
                                this.dependencyGraph.set(dep, new Set());
                            }
                            this.dependencyGraph.get(dep)!.add(col.field);
                        }
                    });
                } catch (e) {
                    console.error(`Error parsing formula for column "${col.field}": ${col.formula}`, e);
                }
            }
        });
    }

    /**
     * 当一个单元格的值更新后，处理所有依赖它的计算
     * @param rowNode 被更新的行节点
     * @param updatedField 被用户直接修改的字段
     * @returns 返回一个Map，key是更新的行节点，value是该行被更新的字段集合
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
                    if (this.updateNode(node, dependentField)) {
                        if (!updates.has(node)) updates.set(node, new Set());
                        updates.get(node)!.add(dependentField);
                        queue.push({ node: node, field: dependentField });
                    }
                });
            }

            // 2. 对父行的聚合公式更新 (向上)
            if (node.parent) {
                this.formulaMap.forEach((formulaInfo, formulaField) => {
                    if (this.isChildDependent(formulaInfo.formula, field)) {
                        if (this.updateNode(node.parent!, formulaField)) {
                            if (!updates.has(node.parent!)) updates.set(node.parent!, new Set());
                            updates.get(node.parent!)!.add(formulaField);
                            queue.push({ node: node.parent!, field: formulaField });
                        }
                    }
                });
            }

            // 3. 对子行的父引用公式更新 (向下)
            if (node.children && node.children.length > 0) {
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
            }
        }
        
        return updates;
    }

    /**
     * 对所有行进行完整的初始计算
     * 需要处理计算顺序，确保依赖项先被计算
     */
    public processAllRows(): void {
        if (this.formulaMap.size === 0) {
            return;
        }

        // 简单的拓扑排序思想：多次迭代，直到没有更多的变更发生
        // 对于复杂的依赖链，这能确保计算顺序正确
        const maxIterations = this.formulaMap.size;
        let iteration = 0;
        let changedInLastPass = true;
        
        while(changedInLastPass && iteration < maxIterations) {
            changedInLastPass = false;
            this.gridApi.forEachNode(n => {
                this.formulaMap.forEach((formulaInfo, field) => {
                    if (this.updateNode(n, field)) {
                        changedInLastPass = true;
                    }
                });
            });
            iteration++;
        }
        if (iteration === maxIterations) {
            console.warn("Possible circular dependency detected in formulas.");
        }
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
        return {
            ...node.data,
            parent: node.parent ? node.parent.data : {},
            children: node.children ? node.children.map(c => c.data) : [],
        };
    }

    private evaluate(parsedExpression: Expression, context: any): any {
        try {
            return parsedExpression.evaluate(context);
        } catch (e) {
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
} 