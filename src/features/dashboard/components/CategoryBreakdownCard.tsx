import React from 'react'
import { PieChart, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CategoryBreakdownPoint } from '../types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'

interface CategoryBreakdownCardProps {
  categories: CategoryBreakdownPoint[]
  currency: string
  locale: string
}

export const CategoryBreakdownCard: React.FC<CategoryBreakdownCardProps> = ({
  categories,
  currency,
  locale,
}) => {
  return (
    <Card className="border-border/80 shadow-xs flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              <span>Spending by Category</span>
            </CardTitle>
            <span className="text-xs text-muted-foreground font-medium">This Month</span>
          </div>
          <CardDescription>
            Expenditure distribution across active operational expense categories.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {categories.map((cat) => (
            <div key={cat.categoryId} className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-medium text-foreground truncate">
                    {cat.categoryName}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-muted-foreground text-[11px]">
                    {cat.percentage.toFixed(1)}%
                  </span>
                  <span className="font-semibold font-mono text-foreground">
                    {formatCurrency(cat.amount, { currency, locale })}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: cat.color,
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </div>

      <div className="p-4 pt-3 border-t border-border/60 mt-3 bg-muted/20 rounded-b-xl flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {categories.length} active spending categories
        </span>
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <Link to="/categories">
            <span>View All Categories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  )
}
