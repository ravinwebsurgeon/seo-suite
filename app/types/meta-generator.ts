export type ResourceType = "product" | "article";
export type MetaStatus =
  | "pending"
  | "generated"
  | "approved"
  | "rejected"
  | "published"
  | "failed";
export type Tone = "professional" | "friendly" | "minimal";
export type JobType = "meta-generation" | "meta-regeneration" | "meta-publish";
export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";
export type FilterValue =
  | "all"
  | "missing_title"
  | "missing_desc"
  | "missing_both"
  | "generated"
  | "approved"
  | "published"
  | "failed";
export type ResourceFilter = "all" | "products" | "articles";

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  seo: { title: string | null; description: string | null };
  updatedAt: string;
}

export interface ShopifyArticle {
  id: string;
  title: string;
  handle: string;
  contentHtml: string;
  seo: { title: string | null; description: string | null };
  updatedAt: string;
}

export interface MetaRecord {
  resourceId: string;
  resourceType: ResourceType;
  title: string;
  handle: string;
  currentSeoTitle: string | null;
  currentSeoDescription: string | null;
  keyword: string | null;
  generatedTitle: string | null;
  generatedDescription: string | null;
  tone: Tone;
  status: MetaStatus;
  dbId: number | null;
  updatedAt: string;
}

export interface GeneratedMeta {
  title_tag: string;
  meta_description: string;
}

export interface DashboardStats {
  products: {
    total: number;
    missingTitle: number;
    missingDescription: number;
    missingBoth: number;
  };
  articles: {
    total: number;
    missingTitle: number;
    missingDescription: number;
    missingBoth: number;
  };
  ai: {
    generated: number;
    pendingApproval: number;
    approved: number;
    published: number;
    failed: number;
  };
  queue: {
    active: number;
    completed: number;
    failed: number;
  };
}

export interface JobRecord {
  id: number;
  shopId: string;
  jobId: string;
  jobType: JobType;
  status: JobStatus;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  errorLog: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface EditorPageData {
  records: MetaRecord[];
  pageInfo: PageInfo;
  totalCount: number;
  filter: FilterValue;
  resourceFilter: ResourceFilter;
  search: string;
  tone: Tone;
}

export interface CsvImportRow {
  handle: string;
  title_tag: string;
  meta_description: string;
  type?: ResourceType;
}

export interface CsvImportValidation {
  valid: CsvImportRow[];
  errors: Array<{ row: number; handle: string; message: string }>;
}
