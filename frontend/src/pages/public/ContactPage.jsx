import { useEffect, useState } from 'react'
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
} from 'lucide-react'
import { getBranches } from '../../api/branches.api'
import { useToast } from '../../hooks/useToast'
import { BRAND } from '../../constants/brand'

const SUBJECTS = [
  'General question',
  'An existing order',
  'Billing',
  'Partnerships',
  'Something else',
]

const FAQS = [
  {
    question: 'How do I book a pickup?',
    answer:
      "Go to Book a pickup, choose your branch and the garments you need cleaned, then pick a pickup window. You'll receive live notifications once confirmed.",
  },
  {
    question: 'How will I know when my order is ready?',
    answer:
      "You'll get an automatic alert at intake, when processing begins, and the instant it's finished and ready for dispatch. You can also track anytime from My orders.",
  },
  {
    question: 'What if I need to change my order?',
    answer:
      'Reach out from this page with your order reference (or contact your branch directly) and we’ll update it, provided processing has not yet started.',
  },
  {
    question: 'Do you offer same-day service?',
    answer:
      'Yes — choose Express 24h at checkout for select services, subject to operating branch capacity.',
  },
]

const initialForm = { name: '', email: '', phone: '', subject: SUBJECTS[0], message: '' }

export default function ContactPage() {
  const { notify } = useToast()
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [branches, setBranches] = useState([])
  const [openFaq, setOpenFaq] = useState(0)

  useEffect(() => {
    let active = true
    getBranches()
      .then((response) => {
        if (active) setBranches(response.data?.data ?? [])
      })
      .catch(() => {
        /* fallback */
      })
    return () => {
      active = false
    }
  }, [])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  function validate() {
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Enter a valid email.'
    if (!form.message.trim() || form.message.trim().length < 10) {
      nextErrors.message = 'Tell us a bit more — at least 10 characters.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 700))
    setSubmitting(false)
    setForm(initialForm)
    notify({
      tone: 'success',
      title: 'Message sent',
      message: "Thanks — we'll get back to you within one business day.",
    })
  }

  return (
    <div className="min-h-screen bg-canvas font-sans pb-24">
      {/* ---------- Hero Header Section ---------- */}
      <section className="relative overflow-hidden bg-slate-950 text-white pt-16 pb-20 sm:pb-24 px-4 sm:px-8 border-b border-white/10">
        {/* Background visual photo */}
        <picture className="absolute inset-0 size-full">
          <source srcSet="/images/laundry-hero-basket.avif" type="image/avif" />
          <source srcSet="/images/laundry-hero-basket.webp" type="image/webp" />
          <img
            src="/images/laundry-hero-basket.jpg"
            alt="Swirl laundry care in clean basket"
            className="size-full object-cover object-center opacity-25 scale-105 transition-transform duration-1000 ease-out"
          />
        </picture>

        {/* Multi-stop Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-indigo-950/75" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent pointer-events-none" />

        {/* Ambient Glow */}
        <div className="absolute top-0 right-1/4 size-72 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 size-60 rounded-full bg-purple-500/20 blur-2xl pointer-events-none animate-pulse" />

        <div className="relative z-10 max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-3.5 py-1.5 rounded-full mb-4 shadow-sm">
              <Sparkles className="size-3.5 text-indigo-300" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-200">
                Customer Support & Enquiries
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight drop-shadow-sm">
              Talk to a real person about your laundry.
            </h1>

            <p className="mt-4 text-slate-200 max-w-xl text-sm sm:text-base leading-relaxed">
              <span className="font-serif italic text-indigo-300 mr-2 font-normal text-lg">
                We're here to help.
              </span>
              Questions about an order, garment care requirements, or branch scheduling — send us a
              message and our support team will reply within one business day.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" /> {BRAND.contact.hours}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" /> Rapid Turnaround
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-400" /> Dedicated Branch Care
              </span>
            </div>
          </div>

          {/* Quick Contact Highlight Card */}
          <div className="w-full lg:w-80 shrink-0 rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-xl shadow-xl">
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-2">
              Direct Contact
            </p>
            <p className="text-xl font-bold text-white mb-4">{BRAND.name} Care</p>
            <div className="space-y-3 text-xs text-slate-200">
              <div className="flex items-center gap-2.5">
                <Phone className="size-4 text-indigo-300 shrink-0" />
                <span className="font-semibold">{BRAND.contact.phone}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="size-4 text-indigo-300 shrink-0" />
                <span className="font-semibold">{BRAND.contact.email}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin className="size-4 text-indigo-300 shrink-0 mt-0.5" />
                <span>{BRAND.contact.address}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="size-4 text-indigo-300 shrink-0" />
                <span>{BRAND.contact.hours}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fancy organic wave edge transition */}
        <div className="absolute bottom-0 inset-x-0 h-6 sm:h-8 text-canvas pointer-events-none overflow-hidden z-20">
          <svg
            className="w-full h-full fill-current"
            viewBox="0 0 1440 48"
            preserveAspectRatio="none"
          >
            <path d="M0,24 C360,48 720,0 1080,24 C1260,36 1380,44 1440,48 L1440,48 L0,48 Z" />
          </svg>
        </div>
      </section>

      {/* ---------- Main Content Grid ---------- */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto grid w-[92%] max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Left: Contact Form Card */}
          <div className="rounded-3xl border border-line bg-white p-6 sm:p-10 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <div className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-ink">Send us a direct message</h2>
                <p className="text-xs text-muted">We typically respond in less than 24 hours.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" error={errors.name}>
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Email address" error={errors.email}>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={updateField}
                    placeholder="ada@example.com"
                    autoComplete="email"
                  />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Phone number (optional)">
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={updateField}
                    placeholder="+234 800 000 0000"
                    autoComplete="tel"
                  />
                </Field>
                <Field label="What is this regarding?">
                  <select name="subject" value={form.subject} onChange={updateField}>
                    {SUBJECTS.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Your message" error={errors.message}>
                <textarea
                  name="message"
                  rows={5}
                  value={form.message}
                  onChange={updateField}
                  placeholder="Tell us what's going on — include your order reference if this is regarding a current pickup or delivery."
                />
              </Field>

              {/* Sharp, prominent Send message button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl bg-indigo-600 px-8 py-4 text-sm font-extrabold text-white shadow-md shadow-indigo-900/20 hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>{submitting ? 'Sending message…' : 'Send message'}</span>
                {!submitting && <Send className="size-4" />}
              </button>
            </form>
          </div>

          {/* Right Column: Visual card with distinct image + Info Cards + Branch Locations */}
          <div className="grid gap-6 content-start">
            {/* Visual card using DISTINCT image: home-benefits (crisp handled laundry carry bags) */}
            <div className="relative overflow-hidden rounded-3xl border border-line bg-slate-900 shadow-md">
              <div className="relative h-44 w-full overflow-hidden">
                <picture className="absolute inset-0 size-full">
                  <source srcSet="/images/home-benefits.avif" type="image/avif" />
                  <source srcSet="/images/home-benefits.webp" type="image/webp" />
                  <img
                    src="/images/hero-laundry-full.jpg"
                    alt="Crisp garments delivered fresh in handled carry bags"
                    className="size-full object-cover scale-105 transition-transform duration-700 hover:scale-110"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5">
                  <span className="inline-block rounded-full bg-indigo-500/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-xs mb-1.5">
                    White-Glove Care
                  </span>
                  <p className="text-sm font-bold text-white drop-shadow-xs">
                    Handled with attention to fabric details, start to finish.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Info Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <InfoCard icon={Phone} label="Call our team" value={BRAND.contact.phone} />
              <InfoCard icon={Mail} label="Email us directly" value={BRAND.contact.email} />
              <InfoCard icon={MapPin} label="Main office" value={BRAND.contact.address} />
              <InfoCard icon={Clock} label="Operating hours" value={BRAND.contact.hours} />
            </div>

            {/* Branch Locations Card */}
            {branches.length > 0 && (
              <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-indigo-600 mb-4">
                  <Building2 className="size-4" />
                  Our Active Branches ({branches.length})
                </p>
                <ul className="grid gap-3 divide-y divide-line">
                  {branches.slice(0, 4).map((branch) => (
                    <li key={branch._id} className="pt-3 first:pt-0">
                      <p className="text-xs font-black text-ink">{branch.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted flex items-start gap-1">
                        <MapPin className="size-3 text-slate-400 mt-0.5 shrink-0" />
                        <span>{branch.address}</span>
                      </p>
                      {branch.phone && (
                        <p className="mt-0.5 text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
                          <Phone className="size-3 shrink-0" />
                          <span>{branch.phone}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------- FAQ Section ---------- */}
      <section className="border-t border-line bg-white py-14 sm:py-18">
        <div className="mx-auto w-[92%] max-w-3xl">
          <div className="text-center mb-10">
            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600">
              Quick Answers
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
              Frequently asked questions
            </h2>
          </div>

          <div className="grid gap-3">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index
              return (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-line bg-canvas/40 transition-all hover:border-indigo-200"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-bold text-ink">{faq.question}</span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs leading-relaxed text-slate-600 border-t border-line/40 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-slate-700">
      <span>{label}</span>
      <span
        className={`[&>input]:w-full [&>input]:rounded-2xl [&>input]:border [&>input]:p-3.5 [&>input]:text-xs [&>input]:font-medium
        [&>select]:w-full [&>select]:rounded-2xl [&>select]:border [&>select]:bg-slate-50/60 [&>select]:p-3.5 [&>select]:text-xs [&>select]:font-semibold
        [&>textarea]:w-full [&>textarea]:rounded-2xl [&>textarea]:border [&>textarea]:p-3.5 [&>textarea]:text-xs [&>textarea]:font-medium
        [&>input]:border-line [&>select]:border-line [&>textarea]:border-line
        [&>input]:bg-slate-50/60 [&>textarea]:bg-slate-50/60
        focus-within:[&>input]:border-indigo-600 focus-within:[&>input]:bg-white focus-within:[&>input]:ring-4 focus-within:[&>input]:ring-indigo-100
        focus-within:[&>select]:border-indigo-600 focus-within:[&>select]:bg-white focus-within:[&>select]:ring-4 focus-within:[&>select]:ring-indigo-100
        focus-within:[&>textarea]:border-indigo-600 focus-within:[&>textarea]:bg-white focus-within:[&>textarea]:ring-4 focus-within:[&>textarea]:ring-indigo-100
        [&>input]:outline-none [&>select]:outline-none [&>textarea]:outline-none
        [&>input]:transition-all [&>select]:transition-all [&>textarea]:transition-all`}
      >
        {children}
      </span>
      {error && <span className="text-[11px] font-semibold text-rose-600">{error}</span>}
    </label>
  )
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-white p-4 shadow-2xs hover:border-indigo-200 transition-colors">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/50">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</p>
        <p className="text-xs font-bold text-ink truncate mt-0.5">{value}</p>
      </div>
    </div>
  )
}
