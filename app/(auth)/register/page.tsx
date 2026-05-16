'use client'
import Link from 'next/link'
import { ShieldAlert, ArrowLeft, Mail } from 'lucide-react'

export default function RegisterDisabledPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'var(--font-ui)',
    }}>
      <div style={{
        width: '100%', maxWidth: 460,
        background: 'var(--surface-1)',
        border: '1px solid var(--border-default)',
        borderRadius: 18,
        padding: '36px 32px',
        textAlign: 'center',
        boxShadow: 'var(--card-shadow-strong)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'color-mix(in srgb, var(--medium) 10%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          <ShieldAlert size={26} color="var(--medium)" />
        </div>
        <h1 style={{
          fontSize: 22, fontWeight: 700,
          fontFamily: 'var(--font-display)', letterSpacing: '-0.4px',
          color: 'var(--text-strong)', marginBottom: 10,
        }}>
          Registration is disabled
        </h1>
        <p style={{
          fontSize: 13, lineHeight: 1.55,
          color: 'var(--text-fainter)',
          fontFamily: 'var(--font-display)',
          marginBottom: 22,
        }}>
          New accounts on SecureX Pro are provisioned by an administrator.
          Contact your administrator to request an account — they&apos;ll create one
          using your email and send you a login.
        </p>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 9,
          background: 'var(--surface-2)',
          border: '1px solid var(--border-subtle)',
          fontSize: 11.5, fontFamily: 'var(--font-mono)',
          color: 'var(--text-dim)', justifyContent: 'center',
          marginBottom: 22,
        }}>
          <Mail size={12} /> admin@securex.pro
        </div>
        <Link href="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '11px 22px', borderRadius: 10,
          background: 'var(--accent)', color: 'var(--accent-on-bg)',
          fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 700,
          textDecoration: 'none', letterSpacing: '0.2px',
          boxShadow: '0 4px 16px var(--glow-accent-soft)',
        }}>
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    </div>
  )
}
