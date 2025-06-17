import { Column, FilterModel, SortModel } from "../types";
export * from './components';

export interface GridState {
  scrollPosition: {
    left: number;
    top: number;
    lastLeft: number;
    lastTop: number;
  };
  editingCell: {
    rowId: string | number;
    field: string;
    value: any;
  } | null;
  selectedNodes: Set<string | number>;
  sortModel: SortModel[];
  filterModel: Map<string, FilterModel>;
  columnState: Map<
    string,
    {
      width: number;
      visible: boolean;
      order: number;
    }
  >;
  dragState: {
    draggedColumn: Column | null;
    draggedElement: HTMLElement | null;
    resizeStartX: number;
    resizeColumn: Column | null;
    resizeElement?: HTMLElement | null;
    initialWidth?: number;
    activeColumnSet?: Column[];
    activeContainer?: 'left' | 'center' | 'right';
    sourceContainer?: 'left' | 'center' | 'right';
    resizeGuideElement?: HTMLElement | null;
  };
  virtualBodyRowIds: Set<string>;
}
