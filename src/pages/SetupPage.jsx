import { Link } from 'react-router-dom'

export default function SetupPage() {
  return (
    <div className="page-center narrow">
      <p className="brand">SYNVEX FORGE</p>
      <h1>Connect Supabase + EmailJS OTP</h1>
      <ol className="setup-list">
        <li>
          Put Supabase + EmailJS keys in <code>.env</code>
        </li>
        <li>
          Run SQL: <code>schema.sql</code>, <code>fix-admin-access.sql</code>, then{' '}
          <code>email-otp.sql</code>
        </li>
        <li>
          Supabase → Authentication → Providers → Email → <strong>Confirm email = OFF</strong>
        </li>
        <li>
          EmailJS OTP template vars: <code>to_email</code>, <code>to_name</code>,{' '}
          <code>otp</code>
        </li>
        <li>
          EmailJS notify template (<code>VITE_EMAILJS_NOTIFY_TEMPLATE_ID</code>) vars:{' '}
          <code>to_email</code>, <code>to_name</code>, <code>subject</code>,{' '}
          <code>title</code>, <code>message</code>
        </li>
        <li>
          Restart <code>npm run dev</code>, then <Link to="/signup">sign up</Link>
        </li>
      </ol>
      <Link to="/" className="btn btn-ghost">
        Back home
      </Link>
    </div>
  )
}
