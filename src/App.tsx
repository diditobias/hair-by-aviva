import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicLayout } from './components/public/PublicLayout'
import { AdminLayout } from './components/admin/AdminLayout'
import { RequireStaff } from './components/shared/RequireStaff'
import { RequireAuth } from './components/shared/RequireAuth'
import { HomePage } from './pages/public/HomePage'
import { ServicesPage } from './pages/public/ServicesPage'
import { AboutPage } from './pages/public/AboutPage'
import { GalleryPage } from './pages/public/GalleryPage'
import { IdeasPage } from './pages/public/IdeasPage'
import { BookPage } from './pages/public/BookPage'
import { AvailabilityPage as PublicAvailabilityPage } from './pages/public/AvailabilityPage'
import { EnquiryPage } from './pages/public/EnquiryPage'
import { ContactPage } from './pages/public/ContactPage'
import { PoliciesPage } from './pages/public/PoliciesPage'
import { FaqPage } from './pages/public/FaqPage'
import { OffersPage } from './pages/public/OffersPage'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage'
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage'
import { AccountLayout } from './pages/account/AccountLayout'
import { AccountOverviewPage } from './pages/account/AccountOverviewPage'
import { AccountOffersPage } from './pages/account/AccountOffersPage'
import { AccountAppointmentsPage } from './pages/account/AccountAppointmentsPage'
import { AccountAppointmentDetailPage } from './pages/account/AccountAppointmentDetailPage'
import { AccountProfilePage } from './pages/account/AccountProfilePage'
import { AccountSettingsPage } from './pages/account/AccountSettingsPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { DashboardPage } from './pages/admin/DashboardPage'
import { BookingsPage } from './pages/admin/BookingsPage'
import { BookingDetailPage } from './pages/admin/BookingDetailPage'
import { NewBookingPage } from './pages/admin/NewBookingPage'
import { ClientsPage } from './pages/admin/ClientsPage'
import { ClientDetailPage } from './pages/admin/ClientDetailPage'
import { EnquiriesPage } from './pages/admin/EnquiriesPage'
import { SettingsPage } from './pages/admin/SettingsPage'
import { ProfilePage } from './pages/admin/ProfilePage'
import { ServicesAdminPage } from './pages/admin/ServicesAdminPage'
import { OffersAdminPage } from './pages/admin/OffersAdminPage'
import { CalendarPage } from './pages/admin/CalendarPage'
import { AvailabilityPage as AdminAvailabilityPage } from './pages/admin/AvailabilityPage'
import { PlaceholderAdminPage } from './pages/admin/PlaceholderAdminPage'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="offers" element={<OffersPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="ideas" element={<IdeasPage />} />
        <Route path="book" element={<BookPage />} />
        <Route path="availability" element={<PublicAvailabilityPage />} />
        <Route path="enquiry" element={<EnquiryPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="policies" element={<PoliciesPage />} />
        <Route path="faq" element={<FaqPage />} />

        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="account/login" element={<Navigate to="/login" replace />} />

        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AccountOverviewPage />} />
          <Route path="offers" element={<AccountOffersPage />} />
          <Route path="appointments" element={<AccountAppointmentsPage />} />
          <Route path="availability" element={<PublicAvailabilityPage />} />
          <Route path="appointments/:id" element={<AccountAppointmentDetailPage />} />
          <Route path="profile" element={<AccountProfilePage />} />
          <Route path="settings" element={<AccountSettingsPage />} />
        </Route>

        <Route path="client" element={<Navigate to="/account" replace />} />
      </Route>

      <Route path="/admin/login" element={<AdminLoginPage />} />

      <Route
        path="/admin"
        element={
          <RequireStaff>
            <AdminLayout />
          </RequireStaff>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="bookings/new" element={<NewBookingPage />} />
        <Route path="bookings/:id" element={<BookingDetailPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="enquiries" element={<EnquiriesPage />} />
        <Route path="services" element={<ServicesAdminPage />} />
        <Route path="offers" element={<OffersAdminPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="gallery"
          element={
            <PlaceholderAdminPage
              title="Gallery"
              description="Upload, categorize and reorder gallery images from here in the next phase."
            />
          }
        />
        <Route
          path="testimonials"
          element={
            <PlaceholderAdminPage
              title="Testimonials"
              description="Add and activate client testimonials before they appear on the public site."
            />
          }
        />
        <Route path="availability" element={<AdminAvailabilityPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
