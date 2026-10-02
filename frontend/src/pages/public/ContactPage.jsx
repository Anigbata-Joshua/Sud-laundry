import { useEffect, useState } from 'react'
import { ChevronDown, Clock, Mail, MapPin, Phone, Send } from 'lucide-react'
import { getBranches } from '../../api/branches.api'
import { useToast } from '../../hooks/useToast'

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
      "Go to Book a pickup, choose a branch and the services you need, then pick a time. You'll get a notification once it's confirmed.",
  },
  {
    question: 'How will I know when my order is ready?',
    answer:
      "You'll get a notification at pickup, when processing starts, and again the moment it's ready — you can also check anytime from My orders.",
  },
  {
    question: 'What if I need to change my order?',
    answer:
      'Reach out from this page with your order reference and we\u2019ll update it, as long as processing hasn\u2019t started yet.',
  },
  {
    question: 'Do you offer same-day service?',
    answer: 'Yes — choose Express at checkout for select services, subject to branch capacity.',
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
        /* branch list is a nice-to-have here; the form still works without it */
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
    // No public "contact" endpoint exists on the backend yet — this simulates
    // the round trip so the flow and notification are ready to wire up to a
    // real POST /contact route (or a mailto/support integration) later.
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
    <>
      <section className="border-b border-line bg-white py-14 sm:py-18">
        <div className="mx-auto flex w-[92%] max-w-6xl flex-col justify-between gap-8 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">Contact</p>
            <h1 className="mt-2 max-w-lg text-[2rem] font-extrabold leading-tight tracking-tight text-ink sm:text-[2.4rem]">
              Talk to a real person about your laundry.
            </h1>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-muted">
              Questions about an order, a branch, or just want to say hi — send us a message and
              we'll reply within one business day.
            </p>
          </div>
          <div className="hidden shrink-0 sm:block">
            <img
              src="/images/laundry-basket.png"
              alt="Suds laundry care"
              className="h-32 w-32 object-contain"
            />
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto grid w-[92%] max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr]">
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
              <Field label="Email" error={errors.email}>
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
              <Field label="Phone (optional)">
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={updateField}
                  placeholder="+234 800 000 0000"
                  autoComplete="tel"
                />
              </Field>
              <Field label="What's this about?">
                <select name="subject" value={form.subject} onChange={updateField}>
                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Message" error={errors.message}>
              <textarea
                name="message"
                rows={5}
                value={form.message}
                onChange={updateField}
                placeholder="Tell us what's going on — include your order reference if this is about a pickup or delivery."
              />
            </Field>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-brand px-5 py-3 text-[13px] font-bold text-white shadow-sm transition hover:bg-sky-700 active:scale-[0.98] disabled:opacity-60"
            >
              {submitting ? 'Sending…' : 'Send message'}
              {!submitting && <Send className="size-4" />}
            </button>
          </form>

          <div className="grid gap-6">
            {/* Visual card */}
            <div className="relative overflow-hidden rounded-2xl border border-line bg-slate-900 shadow-xs">
              <div className="relative h-36 w-full overflow-hidden">
                <img
                  src="/images/laundry-hero-basket.jpg"
                  alt="Fresh textiles in a clean laundry basket"
                  className="size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-black/20 to-transparent" />
                <span className="absolute bottom-3 left-4 text-[12.5px] font-bold text-white drop-shadow-xs">
                  Carefully handled by our team, start to finish
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <InfoCard icon={Phone} label="Call us" value="+234 800 000 0000" />
              <InfoCard icon={Mail} label="Email us" value="hello@suds.example" />
              <InfoCard icon={Clock} label="Hours" value="Mon – Sat, 8am – 7pm" />
            </div>

            {branches.length > 0 && (
              <div className="rounded-2xl border border-line bg-white p-5">
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  <MapPin className="size-3.5" />
                  Our branches
                </p>
                <ul className="mt-3 grid gap-3.5">
                  {branches.slice(0, 4).map((branch) => (
                    <li
                      key={branch._id}
                      className="border-t border-line pt-3.5 first:border-t-0 first:pt-0"
                    >
                      <p className="text-[13px] font-extrabold text-ink">{branch.name}</p>
                      <p className="mt-0.5 text-[12px] text-muted">{branch.address}</p>
                      {branch.phone && <p className="text-[12px] text-muted">{branch.phone}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-cream py-16 sm:py-20">
        <div className="mx-auto w-[92%] max-w-3xl">
          <h2 className="text-[22px] font-extrabold tracking-tight text-ink sm:text-2xl">
            Common questions
          </h2>
          <div className="mt-6 grid gap-2.5">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index
              return (
                <div key={faq.question} className="rounded-2xl border border-line bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <span className="text-[13.5px] font-bold text-ink">{faq.question}</span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <p className="px-5 pb-4 text-[13px] leading-relaxed text-muted">{faq.answer}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}

function Field({ label, error, children }) {
  return (
    <label className="grid gap-2 text-[12.5px] font-bold text-slate-700">
      {label}
      <span
        className={`[&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:p-3 [&>input]:text-[13px] [&>input]:font-normal
        [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:bg-white [&>select]:p-3 [&>select]:text-[13px] [&>select]:font-normal
        [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:p-3 [&>textarea]:text-[13px] [&>textarea]:font-normal
        [&>input]:border-line [&>select]:border-line [&>textarea]:border-line
        focus-within:[&>input]:border-sky-400 focus-within:[&>select]:border-sky-400 focus-within:[&>textarea]:border-sky-400
        [&>input]:outline-none [&>select]:outline-none [&>textarea]:outline-none`}
      >
        {children}
      </span>
      {error && <span className="text-[11px] font-semibold text-red-600">{error}</span>}
    </label>
  )
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-brand">
        <Icon className="size-4.5" />
      </span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">{label}</p>
        <p className="text-[13px] font-bold text-ink">{value}</p>
      </div>
    </div>
  )
}
