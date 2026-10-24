import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useActiveTenant } from '@/features/tenants'
import { formatDate } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { useGenerateNextPayment } from '../hooks/useSubscriptions'
import type { GeneratePaymentResult, SubscriptionStatus } from '../types'

export function GenerateNextPaymentButton({ subscriptionId, status }: {
  subscriptionId: number
  status: SubscriptionStatus
}) {
  const { activeTenant } = useActiveTenant()
  const generate = useGenerateNextPayment()
  const toast = useToast()
  const inFlight = useRef(false)
  const [result, setResult] = useState<GeneratePaymentResult | null>(null)
  const reason = status !== 'ACTIVE' ? 'Only active subscriptions can generate payments' : undefined

  const handleGenerate = async () => {
    if (reason || inFlight.current) return
    inFlight.current = true
    setResult(null)
    try {
      const response = await generate.mutateAsync(subscriptionId)
      setResult(response)
      if (response.alreadyExists) {
        toast.info('Payment already generated', response.message || 'A payment for this billing date already exists.')
      } else {
        toast.success('Payment generated', response.message || 'The linked expense is now available in Expenses.')
      }
    } catch (error) {
      toast.error('Payment generation failed', getApiErrorMessage(error))
    } finally {
      inFlight.current = false
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex" tabIndex={reason ? 0 : undefined} title={reason}>
        <Button size="sm" variant="outline" disabled={Boolean(reason) || generate.isPending}
          aria-busy={generate.isPending} aria-describedby={reason ? `generation-reason-${subscriptionId}` : undefined}
          onClick={() => void handleGenerate()}>
          {generate.isPending && <RefreshCw className="mr-1.5 h-4 w-4 animate-spin motion-reduce:animate-none" />}
          {generate.isPending ? 'Generating payment...' : 'Generate next payment'}
        </Button>
        {reason && <span id={`generation-reason-${subscriptionId}`} className="sr-only">{reason}</span>}
      </span>
      {result && (
        <p role="status" className="text-xs text-muted-foreground">
          {result.alreadyExists ? 'Payment' : 'Generated payment'} #{result.paymentId} for{' '}
          {formatDate(result.scheduledBillingDate, { locale: activeTenant.locale, timeZone: 'UTC' })}.{' '}
          <Link to={`/expenses/${result.expenseId}`} className="font-medium text-foreground underline underline-offset-4">
            {result.alreadyExists ? 'View existing expense' : 'View expense'} #{result.expenseId}
          </Link>
        </p>
      )}
    </div>
  )
}

