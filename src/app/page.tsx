import { SchoolLogin } from "~/app/_components/school-login";
import { env } from "~/env";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "~/app/_components/icon";
import { signIn } from "~/server/auth";
import { LandingNavigation } from "~/app/_components/landing-navigation";
import styles from "./landing.module.css";

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.3 2.9-7.5Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9l3.4-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.5l3.4 2.6C7.2 7.7 9.4 5.9 12 5.9Z"
      />
    </svg>
  );
}
function GoogleLogin() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/dashboard" });
      }}
    >
      <button className={styles.googleButton} type="submit">
        <span>
          <GoogleMark />
        </span>
        Login with Google
      </button>
    </form>
  );
}
export default function HomePage() {
  return (
    <main className={styles.page} id="home">
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="EduTrack home">
          <Icon size={34} />
          <span>EduTrack</span>
        </Link>
        <LandingNavigation />
        <div className={styles.headerActions}>
          <GoogleLogin />
          <SchoolLogin
            googleEnabled={!!(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET)}
          >
            School login
          </SchoolLogin>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <Image
          className={styles.heroImage}
          src="/images/edutrack-classroom.png"
          alt="Student holding books in a bright classroom"
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.heroShade} />
        <div className={styles.heroCopy}>
          <div className={styles.heroBadge}>
            <Icon name="school" size={18} /> YOUR SCHOOL. CONNECTED.
          </div>
          <h1 id="hero-title">
            Track Progress.
            <br />
            <span>Build Brighter Futures.</span>
          </h1>
          <p>
            EduTrack is a comprehensive student attendance and academic
            performance monitoring system designed to keep schools, students,
            and families connected.
          </p>
          <div className={styles.heroActions}>
            <GoogleLogin />
            <Link className={styles.learnMore} href="#features">
              Learn More
            </Link>
          </div>
          <div className={styles.heroHighlights}>
            <span>
              <Icon name="calendar" size={17} /> Daily attendance
            </span>
            <span>
              <Icon name="chart" size={17} /> Academic progress
            </span>
            <span>
              <Icon name="mail" size={17} /> Family updates
            </span>
          </div>
        </div>
      </section>
      <div className={styles.homeRibbon}>
        <div>
          <span>01</span>
          <strong>Show up.</strong>
          <p>Make every school day count.</p>
        </div>
        <div>
          <span>02</span>
          <strong>Keep growing.</strong>
          <p>See progress, one subject at a time.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Stay connected.</strong>
          <p>Bring school and family closer.</p>
        </div>
        <a href="#about">
          Discover EduTrack <Icon name="arrow" size={19} />
        </a>
      </div>

      <div className={styles.content}>
        <section
          id="about"
          className={styles.section}
          aria-labelledby="community-title"
        >
          <p className={styles.sectionLabel}>ABOUT EDUTRACK</p>
          <div className={styles.sectionIntro}>
            <h2 id="community-title">A clearer picture of every school day.</h2>
            <p>
              Attendance, academic progress, and school communication belong
              together. EduTrack helps administrators keep records organized,
              students understand their progress, and families stay informed.
            </p>
          </div>
          <h3 className={styles.subheading}>One connected school community</h3>
          <div className={styles.communityGrid}>
            {[
              ["people", "Students", "View attendance, grades, and progress."],
              [
                "mail",
                "Parents & Guardians",
                "Receive school updates and attendance alerts by email.",
              ],
              [
                "school",
                "Administrators",
                "Manage users, classes, attendance, and reports.",
              ],
            ].map(([icon, title, body]) => (
              <article className={styles.card} key={title}>
                <span className={styles.icon}>
                  <Icon name={icon} size={25} />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="features"
          className={styles.section}
          aria-labelledby="features-title"
        >
          <p className={styles.sectionLabel}>BUILT FOR YOUR SCHOOL DAY</p>
          <div className={styles.sectionIntro}>
            <h2 id="features-title">Less paperwork. More understanding.</h2>
            <p>
              Move from daily records to useful insights with tools that work
              together in one school workspace.
            </p>
          </div>
          <div className={styles.featureGrid}>
            {[
              [
                "calendar",
                "Attendance Tracking",
                "Record present, absent, late, or excused attendance. Review history and prepare absence updates for guardians.",
              ],
              [
                "book",
                "Grade Management",
                "Organize assessments by subject, track scores, and give students a clear view of their academic progress.",
              ],
              [
                "bell",
                "School Notifications",
                "Publish school announcements and send guardian email updates with their consent. Review delivery history in one place.",
              ],
              [
                "chart",
                "Data Analytics",
                "Explore attendance trends and subject performance with interactive charts, then export reports for review.",
              ],
            ].map(([icon, title, body]) => (
              <article className={styles.card} key={title}>
                <span className={styles.icon}>
                  <Icon name={icon} size={25} />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className={styles.gettingStarted}
          aria-labelledby="start-title"
        >
          <div>
            <p className={styles.sectionLabel}>GETTING STARTED</p>
            <h2 id="start-title">Your school journey, in three steps.</h2>
            <p>
              New Google registrations are reviewed by your school before access
              is granted.
            </p>
            <SchoolLogin
              googleEnabled={!!(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET)}
            >
              Go to school login <Icon name="arrow" size={16} />
            </SchoolLogin>
          </div>
          <ol className={styles.steps}>
            <li>
              <strong>Connect your account</strong>
              <p>
                Continue with Google and use the account you want to register
                with your school.
              </p>
            </li>
            <li>
              <strong>Confirm your email</strong>
              <p>
                Open the EduTrack confirmation email and confirm your account.
              </p>
            </li>
            <li>
              <strong>Get school approval</strong>
              <p>
                Your administrator assigns your student number and class. Once
                approved, sign in to see your workspace.
              </p>
            </li>
          </ol>
        </section>

        <section
          className={styles.section}
          aria-labelledby="integrations-title"
        >
          <h2 id="integrations-title">Our Integrations</h2>
          <div className={styles.integrations}>
            <div className={styles.integration}>
              <GoogleMark />
              <div>
                <h3>Google OAuth</h3>
                <p>Secure authentication</p>
              </div>
            </div>
            <div className={styles.integration}>
              <span className={styles.emailIcon}>
                <Icon name="mail" size={26} />
              </span>
              <div>
                <h3>Resend</h3>
                <p>Guardian email notifications</p>
              </div>
            </div>
            <div className={styles.integration}>
              <span className={styles.chartIcon}>
                <Icon name="chart" size={26} />
              </span>
              <div>
                <h3>Chart.js</h3>
                <p>Interactive charts & graphs</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section
        id="contact"
        className={styles.contact}
        aria-labelledby="contact-title"
      >
        <div className={styles.contactLayout}>
          <div>
            <p className={styles.sectionLabel}>WE ARE HERE TO HELP</p>
            <h2 id="contact-title">
              Stay connected.
              <br />
              Get the help you need.
            </h2>
            <p className={styles.contactIntro}>
              Your school administrator is your point of contact for account
              access and school records. Find the right next step below.
            </p>
            <div className={styles.supportCard}>
              <span className={styles.icon}>
                <Icon name="people" size={25} />
              </span>
              <h3>Holy Cross Colleges, Inc.</h3>
              <address className={styles.contactDetails}>
                <a href="mailto:info@holycrosscollegepampanga.edu.ph">
                  <Icon name="mail" size={20} />
                  <span>
                    <strong>Email the school</strong>
                    info@holycrosscollegepampanga.edu.ph
                  </span>
                </a>
                <a
                  href="https://www.facebook.com/hccstaanapampanga"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="people" size={20} />
                  <span>
                    <strong>Message on Facebook</strong>Holy Cross Colleges,
                    Inc. <span aria-hidden="true">↗</span>
                  </span>
                </a>
                <a
                  href="https://www.bing.com/maps?where1=Sta.%20Lucia%2C%20Santa%20Ana%2C%20Philippines%2C%202022"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="school" size={20} />
                  <span>
                    <strong>Visit the school</strong>Sta. Lucia, Santa Ana,
                    Philippines, 2022 <span aria-hidden="true">↗</span>
                  </span>
                </a>
              </address>
              <p>
                For account assistance, include your name, class, and a short
                description of the issue so they can help you.
              </p>
              <p className={styles.supportNote}>
                Never include your password or email confirmation link.
              </p>
              <SchoolLogin
                googleEnabled={!!(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET)}
              >
                Open school login <Icon name="arrow" size={16} />
              </SchoolLogin>
            </div>
          </div>
          <div className={styles.faq}>
            <h3>Quick answers</h3>
            {[
              [
                "How do I get my account approved?",
                "Confirm your email first, then contact your school administrator. They need to assign your student number and class before approving access. After approval, use Continue with Google to sign in.",
              ],
              [
                "My attendance or grade looks incorrect. What should I do?",
                "Contact your school administrator with the date or assessment name and the correction you need. School records can only be updated by an authorized administrator.",
              ],
              [
                "How do parents and guardians receive updates?",
                "Your administrator records a guardian email address and consent to receive updates. Guardians receive emails and do not need an EduTrack login. Contact your school to update an email address or notification consent.",
              ],
              [
                "I cannot sign in. Where should I start?",
                "If you registered with Google, choose Continue with Google using the same account. Email confirmation and school approval must both be complete. For school-issued email and password accounts, ask your administrator for help with access.",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
