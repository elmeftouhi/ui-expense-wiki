/**
 * Receipt scanning, document ingestion, and OCR data models.
 * Prepared for future OCR parsing, upload workflows, and camera capture.
 */

export type ReceiptScanStatus =
  | 'PENDING_UPLOAD'
  | 'PROCESSING_OCR'
  | 'EXTRACTED'
  | 'MANUALLY_REVIEWED'
  | 'FAILED'

export interface ReceiptLineItem {
  id?: string
  description: string
  quantity?: number
  unitPrice?: number
  totalAmount: number
}

export interface ExtractedReceiptData {
  merchantName?: string
  merchantAddress?: string
  transactionDate?: string
  totalAmount?: number
  currency?: string
  taxAmount?: number
  confidenceScore?: number // 0 to 1
  lineItems: ReceiptLineItem[]
  suggestedCategoryId?: number | string
}

export interface ReceiptDocument {
  id: number | string
  tenantId: number | string
  fileName: string
  fileUrl?: string
  thumbnailUrl?: string
  mimeType: string
  fileSizeBytes: number
  status: ReceiptScanStatus
  extractedData?: ExtractedReceiptData
  linkedExpenseId?: number | string
  uploadedByUserId: number | string
  uploadedAt: string
}
