export function PoliciesPage() {
  return (
    <section className="section section-narrow">
      <div className="section-head">
        <h2>Policies</h2>
        <p>Simple guidelines so appointments run smoothly for everyone.</p>
      </div>
      <div className="service-list">
        <div className="service-row">
          <div>
            <h3>Booking requests</h3>
            <p>
              Online bookings are requests until Aviva confirms. You will receive confirmation once the time
              is locked in.
            </p>
          </div>
        </div>
        <div className="service-row">
          <div>
            <h3>Cancellations & reschedules</h3>
            <p>
              Please give as much notice as possible. Reschedule requests are reviewed by Aviva and do not
              automatically change a confirmed appointment.
            </p>
          </div>
        </div>
        <div className="service-row">
          <div>
            <h3>Home visits</h3>
            <p>
              Aviva serves Johannesburg suburbs. Share your suburb (and full address if needed) so travel
              can be planned. Travel fees may apply depending on distance.
            </p>
          </div>
        </div>
        <div className="service-row">
          <div>
            <h3>Privacy</h3>
            <p>
              Your contact details and address are used only to manage appointments and are never shown to
              other clients.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
