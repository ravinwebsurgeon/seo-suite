export type CollectionType = "manual" | "automated";

export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export interface CollectionRule {
  column: string;
  condition: string;
  relation: string;
}

export interface CollectionNode {
  id: string;
  title: string;
  handle: string;
  productsCount: { count: number };
  ruleSet: { rules: CollectionRule[] } | null;
  updatedAt: string;
}

export interface Collection {
  id: string;
  title: string;
  handle: string;
  type: CollectionType;
  productsCount: number;
  updatedAt: string;
  isEmpty: boolean;
  isBroken: boolean;
}

export interface OrphanProduct {
  id: string;
  title: string;
  status: ProductStatus;
}

export interface DashboardStats {
  totalCollections: number;
  emptyCollections: number;
  brokenAutomated: number;
  orphanProducts: number;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface DeleteResult {
  deletedCollectionId: string | null;
  userErrors: Array<{ field: string[]; message: string }>;
}

export interface UserError {
  field: string[];
  message: string;
}

export type SortColumn = "title" | "type" | "productsCount" | "updatedAt";
export type SortDirection = "asc" | "desc";

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}
