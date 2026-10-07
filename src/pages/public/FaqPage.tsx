const faqs = [
  {
    q: 'Do I need an account to book?',
    a: 'No. You can request a booking without an account. Create one to follow your appointments, receive announcements, and claim deals or visit rewards.',
  },
  {
    q: 'Is my booking confirmed straight away?',
    a: 'Online bookings are requests. Aviva reviews the time and location, then confirms, suggests another slot, or declines.',
  },
  {
    q: 'Do you come to my home?',
    a: 'Yes — hair appointments are home visits across Johannesburg. Share your suburb (and address if needed) when you request a booking.',
  },
  {
    q: 'Which areas do you cover?',
    a: 'Aviva is based in Johannesburg and serves suburbs across the city and surrounds. Ask about your area when you book or get in touch.',
  },
  {
    q: 'Where are wig / sheitel appointments?',
    a: 'At Aviva’s private Johannesburg studio location. Exact details are shared after your appointment is confirmed.',
  },
  {
    q: 'How do deals and free visits work?',
    a: 'Aviva posts deals, sales, and announcements for account holders. She can also set a loyalty reward — for example one visit free — that unlocks after a number of completed appointments she chooses. Sign in to see them and claim when you qualify.',
  },
  {
    q: 'Can I reschedule?',
    a: 'Yes. If you have an account you can request a reschedule. Confirmed appointments only change after Aviva approves.',
  },
]

export function FaqPage() {
  return (
    <section className="section section-narrow">
      <div className="section-head">
        <h2>FAQs</h2>
        <p>Quick answers about booking, home visits and wig appointments.</p>
      </div>
      <div className="service-list">
        {faqs.map((item) => (
          <div className="service-row" key={item.q}>
            <div>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
