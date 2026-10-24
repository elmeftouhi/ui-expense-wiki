import React from 'react'
import { UploadCloud, ScanLine, FileText, CheckCircle2, Clock, Sparkles } from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const ReceiptsPage: React.FC = () => {
  const { activeTenant, canEdit } = useActiveTenant()

  const sampleQueue = [
    {
      id: 'REC-884',
      fileName: 'hotel_invoice_mar24.pdf',
      size: '1.4 MB',
      status: 'EXTRACTED',
      merchant: 'Grand Hyatt Berlin',
      extractedAmount: '€340.00',
    },
    {
      id: 'REC-885',
      fileName: 'uber_receipt_trip.jpg',
      size: '420 KB',
      status: 'PROCESSING_OCR',
      merchant: 'Detecting...',
      extractedAmount: '—',
    },
    {
      id: 'REC-886',
      fileName: 'hardware_store_receipt.png',
      size: '2.1 MB',
      status: 'MANUALLY_REVIEWED',
      merchant: 'Bauhaus Tech',
      extractedAmount: '€112.50',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Receipt Scanning & OCR
          </h1>
          <Badge variant="outline" className="text-xs">
            {activeTenant.name}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Automated document intake, image OCR, and intelligent transaction extraction foundation.
        </p>
      </div>

      {/* Upload Dropzone Placeholder */}
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
        <CardContent className="p-8 md:p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 rounded-full bg-primary/10 text-primary">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-md">
            <h3 className="font-semibold text-base text-foreground">
              Drop receipts or invoices here
            </h3>
            <p className="text-xs text-muted-foreground">
              Supports PDF, PNG, JPG, or WEBP up to 10MB per document. OCR extraction engine and camera capture will be wired in upcoming integration steps.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button disabled={!canEdit} size="default" className="flex items-center gap-2">
              <ScanLine className="w-4 h-4" />
              <span>Select Receipt Files</span>
            </Button>
            <Button variant="outline" size="default" disabled={!canEdit}>
              Open Camera
            </Button>
          </div>

          {!canEdit && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Your role has read-only access. Uploading receipts requires Editor or Admin role.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Processing Pipeline Status Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Ingestion Queue (Foundation Placeholder)
            </CardTitle>
            <Badge variant="secondary">3 Documents</Badge>
          </div>
          <CardDescription>
            Types configured in <code className="font-mono text-xs">src/features/receipts/types</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">File Name</th>
                  <th className="p-3">Extracted Merchant</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sampleQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono text-muted-foreground">{item.id}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{item.fileName}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{item.size}</span>
                    </td>
                    <td className="p-3 text-foreground">{item.merchant}</td>
                    <td className="p-3 font-mono font-semibold">{item.extractedAmount}</td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={
                          item.status === 'EXTRACTED'
                            ? 'success'
                            : item.status === 'PROCESSING_OCR'
                            ? 'warning'
                            : 'outline'
                        }
                        className="text-[10px] px-2 py-0 inline-flex items-center gap-1"
                      >
                        {item.status === 'PROCESSING_OCR' && (
                          <Clock className="w-3 h-3 animate-spin" />
                        )}
                        {item.status === 'EXTRACTED' && <CheckCircle2 className="w-3 h-3" />}
                        <span>{item.status}</span>
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
