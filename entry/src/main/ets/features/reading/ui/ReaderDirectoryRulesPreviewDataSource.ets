import { ReaderDirectoryPageWindow } from './ReaderDirectoryNavigationList';
import type { ReaderDirectoryNavigationNode } from '../application/ReaderDirectoryNavigation';
import type { ReaderDirectoryRulesPreview } from '../application/ReaderDirectoryRulesGateway';

export interface ReaderDirectoryRulesPreviewItem { key: string; index: number; node?: ReaderDirectoryNavigationNode; }

/** Preview ranges share the existing platform directory page LRU. No target
 * resolver or formal navigation identity is supplied to these read-only rows. */
export class ReaderDirectoryRulesPreviewDataSource implements IDataSource {
  private preview: ReaderDirectoryRulesPreview | undefined = undefined;
  private readonly pages: ReaderDirectoryPageWindow = new ReaderDirectoryPageWindow();
  private readonly pending: Set<number> = new Set();
  private readonly failed: Set<number> = new Set();
  private listeners: DataChangeListener[] = [];
  private readonly load: (offset: number) => void;
  constructor(load: (offset: number) => void) {this.load=load;}
  totalCount(): number { return this.preview?.nodeCount ?? 0; }
  currentId(): string { return this.preview?.proof.previewId ?? ''; }
  firstFailure(): number | undefined { for(const offset of this.failed) return offset; return undefined; }
  clear(): void {
    this.preview=undefined;this.pages.clear();this.pending.clear();this.failed.clear();
    for(const listener of this.listeners) listener.onDataReloaded();
  }
  replace(preview: ReaderDirectoryRulesPreview): void {
    this.clear();this.preview=preview;
    this.pages.bind({status:'ready',viewId:preview.proof.previewId,navigationRevision:preview.proof.navigationRevision,
      identity:{sourceId:'local',bookId:preview.bookId,catalogRevision:preview.proof.inputRevision,structureRevision:preview.proof.navigationRevision},
      visibleTotal:preview.nodeCount,nodes:[]});
    this.pages.put(0,preview.nodes);preview.nodes=[];
    for(const listener of this.listeners) listener.onDataReloaded();
  }
  getData(index: number): ReaderDirectoryRulesPreviewItem {
    const offset=Math.floor(index/256)*256,page=this.pages.get(offset),node=page?.[index-offset];
    if(node===undefined && index>=0 && index<this.totalCount()) this.request(offset);
    return {key:node===undefined ? `${this.currentId()}:${index}` : `${this.currentId()}:${node.nodeId}`,index,node};
  }
  request(offset: number): void {
    if(this.pages.get(offset)!==undefined||this.pending.has(offset)||this.failed.has(offset)||offset<0||offset>=this.totalCount()) return;
    const id=this.currentId();this.pending.add(offset);
    void Promise.resolve().then((): void=>{if(id===this.currentId()&&this.pending.has(offset))this.load(offset);});
  }
  admit(page: ReaderDirectoryRulesPreview): void {
    if(page.proof.previewId!==this.currentId())return;
    this.pending.delete(page.offset);this.failed.delete(page.offset);this.pages.put(page.offset,page.nodes);
    for(const listener of this.listeners) for(let i=0;i<page.nodes.length;i+=1)listener.onDataChange(page.offset+i);
  }
  reject(offset: number): void { this.pending.delete(offset);this.failed.add(offset); }
  retry(): void { const offset=this.firstFailure();if(offset!==undefined){this.failed.delete(offset);this.request(offset);} }
  registerDataChangeListener(listener: DataChangeListener): void {this.listeners.push(listener);}
  unregisterDataChangeListener(listener: DataChangeListener): void {this.listeners=this.listeners.filter((value: DataChangeListener): boolean=>value!==listener);}
}
