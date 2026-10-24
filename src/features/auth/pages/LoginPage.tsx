import React, { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ApiClientError } from '@/api/client'

export const LoginPage: React.FC = () => {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please provide both email and password.')
      return
    }

    setIsSubmitting(true)
    try {
      await login({ email: email.trim(), password })
      navigate('/')
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401 || err.status === 400) {
          setError('Invalid email or password. Please check your credentials.')
        } else if (typeof err.data === 'object' && err.data !== null && 'message' in err.data) {
          setError(String((err.data as { message: string }).message))
        } else {
          setError(err.message || 'Authentication failed. Please try again.')
        }
      } else {
        setError('Network failure or backend unavailable.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickDemoFill = () => {
    setEmail('elmeftouhi@gmail.com')
    setPassword('Password')
    setError(null)
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-primary/5 select-none">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-bold text-2xl mb-1">
            ₩
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            expense<span className="text-primary">.wiki</span>
          </h1>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Multi-Tenant Expense Management & Corporate Financial Intelligence
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border/80 shadow-xl bg-card/95 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-bold text-foreground">Sign In</CardTitle>
            <CardDescription className="text-xs">
              Enter your corporate credentials to access your tenant dashboard.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-in fade-in-50"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Work Email</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoComplete="email"
                  className="w-full h-9 px-3 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                />
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Password</span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="w-full h-9 pl-3 pr-9 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-9 text-xs font-medium gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </form>

            {/* Quick Demo Fill button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleQuickDemoFill}
                className="w-full py-1.5 px-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>Fill Demo Credentials (admin@acme.com)</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer Link to Register */}
        <div className="text-center space-y-2 text-xs text-muted-foreground">
          <p>
            Don&apos;t have an organization account?{' '}
            <Link
              to="/register"
              className="font-semibold text-primary hover:underline cursor-pointer"
            >
              Create Account
            </Link>
          </p>
          <div className="flex items-center justify-center gap-1 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secure JWT Bearer Authentication • API v1</span>
          </div>
        </div>
      </div>
    </div>
  )
}
