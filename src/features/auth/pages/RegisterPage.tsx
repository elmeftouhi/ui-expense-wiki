import React, { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import {
  Lock,
  Mail,
  Building,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { authStorage } from '../services/authStorage'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ApiClientError } from '@/api/client'

export const RegisterPage: React.FC = () => {
  const { isAuthenticated, register } = useAuth()
  const navigate = useNavigate()

  const [tenantName, setTenantName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [rememberCredentials, setRememberCredentials] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!tenantName.trim()) {
      setError('Please provide an organization name.')
      return
    }
    if (tenantName.trim().length < 3) {
      setError('Organization name must be at least 3 characters.')
      return
    }
    if (!email.trim()) {
      setError('Please provide a valid email.')
      return
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setIsSubmitting(true)
    try {
      await register({
        tenantName: tenantName.trim(),
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      })

      if (rememberCredentials) {
        authStorage.setRememberedCredentials({ email: email.trim(), password })
      }

      navigate('/')
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (typeof err.data === 'object' && err.data !== null) {
          const errData = err.data as {
            message?: string
            validationErrors?: Record<string, string>
          }
          if (errData.validationErrors) {
            const firstErr = Object.values(errData.validationErrors)[0]
            setError(firstErr || 'Registration validation failed.')
          } else if (errData.message) {
            setError(errData.message)
          } else {
            setError(err.message || 'Registration failed.')
          }
        } else {
          setError(err.message || 'Registration failed. Please try again.')
        }
      } else {
        setError('Network failure or backend unavailable.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-primary/5 select-none">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-bold text-2xl mb-1">
            ₩
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            expense<span className="text-primary">.wiki</span>
          </h1>
        </div>

        {/* Register Card */}
        <Card className="border-border/80 shadow-xl bg-card/95 backdrop-blur-sm">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-lg font-bold text-foreground">
              Create Account
            </CardTitle>
          </CardHeader>

          <CardContent>
            {error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs animate-in fade-in-50"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} autoComplete="on" className="space-y-4">
              {/* Organization Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="tenantName"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <Building className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Organization</span>
                </label>
                <input
                  id="tenantName"
                  name="organization"
                  type="text"
                  required
                  minLength={3}
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full h-9 px-3 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                />
              </div>

              {/* Name Fields (First & Last) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="firstName"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>First Name</span>
                  </label>
                  <input
                    id="firstName"
                    name="given-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Alex"
                    autoComplete="given-name"
                    className="w-full h-9 px-3 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="lastName"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Last Name</span>
                  </label>
                  <input
                    id="lastName"
                    name="family-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    autoComplete="family-name"
                    className="w-full h-9 px-3 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                  />
                </div>
              </div>

              {/* Email field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="register-email"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Email</span>
                </label>
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email username"
                  className="w-full h-9 px-3 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                />
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="register-password"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Password</span>
                </label>
                <div className="relative">
                  <input
                    id="register-password"
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    className="w-full h-9 pl-3 pr-9 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember credentials */}
              <div className="flex items-center justify-between pt-0.5">
                <label
                  htmlFor="remember-credentials-register"
                  className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors select-none"
                >
                  <input
                    type="checkbox"
                    id="remember-credentials-register"
                    name="remember"
                    checked={rememberCredentials}
                    onChange={(e) => setRememberCredentials(e.target.checked)}
                    className="w-4 h-4 rounded border-input text-primary focus:ring-1 focus:ring-ring cursor-pointer"
                  />
                  <span>Remember credentials</span>
                </label>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-9 text-xs font-medium gap-1.5 cursor-pointer mt-1"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer Link to Login */}
        <div className="text-center text-xs text-muted-foreground">
          <p>
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-primary hover:underline cursor-pointer"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}