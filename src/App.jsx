import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, Bath, BedDouble, Bell, Bookmark, Building2, CalendarDays,
  Car, Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, Eye, FileText,
  Heart, Home, LayoutDashboard, LogOut, Map as MapIcon, MapPin, Menu, MessageCircle,
  Plus, Search, Send, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Star,
  TrendingUp, Upload, UserRound, Users, Wifi, X, WashingMachine, Sofa, Utensils,
  Snowflake, Scale, CircleHelp, BarChart3, Phone, Mail, KeyRound, MoreHorizontal, Wrench, Trash2,
  RotateCcw
} from "lucide-react";
import { amenityOptions, defaultPreferences, initialProperties, locations, propertyTypes } from "./data.js";

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const fallbackImage = "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85";
const staticPreview = import.meta.env.VITE_STATIC_PREVIEW === "true";
const adminDemoAccount = { email: "admin@rentmatch.local", password: "RentMatch123", name: "RentMatch Admin" };
const landlordDemoAccount = { email: "landlord@rentmatch.local", password: "RentMatch123", name: "Maya Santos" };

async function apiRequest(url, options) {
  if (staticPreview) {
    throw new Error("Server-backed actions are unavailable in this GitHub Pages preview.");
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      if (body.message) message = body.message;
    } catch {
      // Use the HTTP status when the server does not return a JSON error.
    }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function tenantInterestText(propertyName) {
  return `Hi! I'm interested in ${propertyName}. Could you tell me more about availability and viewing options?`;
}

function normalizeStoredMessages(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages.map((message) => {
    const isLegacyWelcome = message?.id === "welcome-message"
      || /thanks for saving the poblacion loft/i.test(message?.text || "");
    const isLegacyHostGreeting = /^hello, thanks for your interest in .+\. what would you like to know\?$/i.test(message?.text || "");
    if (!isLegacyWelcome && !isLegacyHostGreeting) return message;
    if (isLegacyWelcome) {
      return {
        id: "welcome-message",
        person: "Maya Santos",
        property: "Anyayahan Apartment",
        propertyId: "anyayahan-apartment",
        from: "Gabriela Ramos",
        sender: "me",
        text: tenantInterestText("Anyayahan Apartment"),
        time: message.time || "9:42 AM",
      };
    }
    const propertyName = message.property
      || message.text?.match(/^Hello, thanks for your interest in (.+)\. What would you like to know\?$/i)?.[1]
      || "this listing";
    const matchedProperty = initialProperties.find((property) => property.name === propertyName);
    return {
      ...message,
      from: message.from && message.from !== message.person ? message.from : "Gabriela Ramos",
      sender: "me",
      property: propertyName,
      propertyId: message.propertyId || matchedProperty?.id,
      text: tenantInterestText(propertyName),
    };
  });
}

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return initialValue;
      const parsed = JSON.parse(stored);
      if (key === "rentmatch-properties" && Array.isArray(parsed)) {
        const initialIds = new Set(initialValue.map((property) => property.id));
        const storedById = new Map(parsed.map((property) => [property.id, property]));
        const mergedInitial = initialValue.map((property) => ({
          ...property,
          ...storedById.get(property.id),
        }));
        const userAdded = parsed.filter((property) => !initialIds.has(property.id));
        return [...userAdded, ...mergedInitial];
      }
      if (key === "rentmatch-messages") return normalizeStoredMessages(parsed);
      return parsed;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage is best-effort for this browser-only prototype.
    }
  }, [key, value]);
  return [value, setValue];
}

function priceUnitLabel(property) {
  if (property.priceOptions?.length) return property.priceOptionsLabel || "depending on AC option";
  if (property.priceBasis === "per-person-month") return "per person / month";
  if (property.priceBasis === "per-person") return "per person; period not stated";
  if (property.priceBasis === "unspecified") return "listed price";
  return "month";
}

function unitAvailabilityLabel(property) {
  if (property.availabilityNotListed) return "Availability not listed";
  if (!Number.isInteger(property.units)) return "Availability not listed";
  return `${property.units} unit${property.units === 1 ? "" : "s"} available`;
}

function depositLabel(property) {
  return property.deposit == null
    ? "Security deposit not listed"
    : `${currency.format(property.deposit)} security deposit`;
}

function displayPrice(property) {
  if (property.priceOptions?.length) {
    const prices = [...new Set(property.priceOptions.map((option) => option.price))];
    if (prices.length === 1) return currency.format(prices[0]);
    return `${currency.format(Math.min(...prices))}–${currency.format(Math.max(...prices))}`;
  }
  return currency.format(property.price);
}

function getMatchScore(property, preferences) {
  let score = 20;
  if (preferences.location === "All locations") score += 8;
  else if (property.location.toLowerCase().includes(preferences.location.toLowerCase())) score += 22;
  else score += 2;
  if (property.price <= Number(preferences.budget)) {
    score += 12 + Math.round(10 * (1 - property.price / Number(preferences.budget)));
  }
  if (!preferences.types?.length) score += 8;
  else if (preferences.types.includes(property.type)) score += 18;
  else score += 2;
  if (preferences.amenities?.length) {
    const matching = preferences.amenities.filter((amenity) => property.amenities.includes(amenity)).length;
    score += Math.round((matching / preferences.amenities.length) * 15);
  } else score += 8;
  if (preferences.distance === "Any distance") score += 5;
  else if (preferences.distance === "Near schools" && property.distance.toLowerCase().includes("university")) score += 10;
  else if (preferences.distance === "Near transport" && property.distance.toLowerCase().includes("transport")) score += 10;
  else if (preferences.distance !== "Any distance") score += 2;
  return Math.max(52, Math.min(98, score));
}

function Brand({ onClick, inverse = false }) {
  return <button className={`brand ${inverse ? "brand-inverse" : ""}`} type="button" onClick={onClick} aria-label="RentMatch home"><img className="brand-logo" src={`${import.meta.env.BASE_URL}Images/rentmatch-logo.png`} alt="RentMatch" /></button>;
}

function Button({ children, variant = "primary", size = "normal", className = "", ...props }) {
  return <button className={`button button-${variant} button-${size} ${className}`} {...props}>{children}</button>;
}

function Field({ label, className = "", ...props }) {
  return <label className={`form-field ${className}`}><span>{label}</span>{props.children || <input {...props} />}</label>;
}

function MatchBadge({ score }) {
  return <span className="match-badge"><Sparkles size={13} /> {score}% match</span>;
}

function PropertyCard({
  property,
  score,
  saved,
  compared,
  onSave,
  onCompare,
  onOpen,
}) {
  return (
    <article className="property-card">
      <button
        className="property-image-button"
        type="button"
        onClick={onOpen}
        aria-label={`View ${property.name}`}
      >
        <img
          className="property-image"
          src={property.image || fallbackImage}
          alt={`${property.name} rental in ${property.location}`}
          loading="lazy"
        />
        {property.label && (
          <span className="property-label">{property.label}</span>
        )}
      </button>
      <button
        className={`icon-button save-property ${saved ? "is-saved" : ""}`}
        type="button"
        onClick={onSave}
        aria-label={
          saved
            ? `Remove ${property.name} from saved homes`
            : `Save ${property.name}`
        }
        aria-pressed={saved}
      >
        <Heart size={18} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="property-card-body">
        <div className="property-title-row">
          <h3>{property.name}</h3>
          <span className="property-rating">
            {property.rating ? (
              <><Star size={14} fill="currentColor" /> {property.rating}</>
            ) : (
              <span className="rating-new">New</span>
            )}
          </span>
        </div>
        <p className="property-location">
          <MapPin size={14} /> {property.location}, Batangas City
        </p>
        <div className="property-meta">
          <span>
            <BedDouble size={14} /> {property.bedrooms}{" "}
            {property.bedrooms === 1 ? "bed" : "beds"}
          </span>
          <span>
            <Bath size={14} /> {property.bathrooms} bath
          </span>
          <span>{property.type}</span>
        </div>
        <div className="property-bottom">
          <p className="property-price">
            <strong>{displayPrice(property)}</strong>
            <span> / {priceUnitLabel(property)}</span>
          </p>
          <MatchBadge score={score} />
        </div>
        <div className="property-actions">
          <Button
            variant={compared ? "selected" : "outline"}
            size="small"
            onClick={onCompare}
          >
            <Scale size={14} /> {compared ? "Added" : "Compare"}
          </Button>
          <Button variant="ghost" size="small" onClick={onOpen}>
            Details <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </article>
  );
}

function SectionHeading({ eyebrow, title, detail, action }) {
  return <div className="section-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{detail && <p className="section-detail">{detail}</p>}</div>{action}</div>;
}

function Landing({ properties, onRole, onLogin, onRegister, onBrowse }) {
  const faqs = [
    ["How does RentMatch find a good fit?", "Tell us what matters to you, from monthly budget and preferred neighborhood to practical amenities. We score each available listing against those preferences."],
    ["Are the listings verified?", "This demo uses sample listings to show the experience. In a live service, RentMatch would verify host identity and property details before publication."],
    ["Can I compare rentals side by side?", "Yes. Add up to three homes to Compare to review rent, location, amenities, availability, ratings, and your match score together."]
  ];
  return <div className="public-page">
    {staticPreview && <div className="static-preview-notice" role="status">Static preview: browsing and demo sign-in are available; server-backed actions require the full RentMatch app.</div>}
    <header className="public-header"><Brand onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} /><nav className="public-links" aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#featured">Featured homes</a><a href="#faqs">FAQs</a></nav><div className="public-actions"><button className="text-button desktop-auth" onClick={onLogin}>Log in</button><Button variant="outline" size="small" onClick={onRegister}>Create account <ArrowRight size={15} /></Button><button className="text-button mobile-login" onClick={onLogin}>Log in</button></div></header>
    <main>
      <section className="landing-hero">
        <div className="hero-image" role="img" aria-label="A bright, welcoming modern rental home in Batangas" />
        <div className="hero-shade" />
        <div className="hero-content"><span className="hero-kicker"><MapPin size={15} /> BATANGAS CITY, PHILIPPINES</span><h1>Find your ideal rental home <em>in Batangas City.</em></h1><p>Compare, match, and discover a place that fits your life, your budget, and your next chapter.</p><div className="hero-actions"><Button variant="light" onClick={() => onRole("renter")}>Find a home <ArrowRight size={16} /></Button><a href="#how-it-works" className="hero-secondary">See how it works <ChevronRight size={16} /></a></div><div className="hero-proof"><div className="avatar-stack"><span>G</span><span>M</span><span>A</span><span>+</span></div><span>Made for renters and local hosts</span></div></div>
        <div className="hero-note"><span>01 / 03</span><span>Find a place to call yours</span></div>
      </section>
      <section className="role-section" id="how-it-works"><div className="role-intro"><p className="eyebrow">A BETTER WAY TO RENT</p><h2>Start with what<br />brings you here.</h2><p>One local marketplace. Two ways to make a move.</p></div><div className="role-cards">
        <article className="role-card renter-role"><div className="role-icon"><Home size={22} /></div><div className="role-card-copy"><span className="role-caption">FOR RENTERS</span><h3>Find a home that fits.</h3><p>Browse rentals, compare your options, and get matched to a place that feels right.</p><Button onClick={() => onRole("renter")}>Continue as renter <ArrowRight size={16} /></Button></div><div className="role-card-art renter-art"><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=700&q=85" alt="A sunlit apartment living room" loading="lazy" /></div></article>
        <article className="role-card landlord-role"><div className="role-icon"><Building2 size={22} /></div><div className="role-card-copy"><span className="role-caption">FOR PROPERTY HOSTS</span><h3>Meet your next tenant.</h3><p>Showcase your property, respond to inquiries, and stay on top of applications.</p><Button variant="navy" onClick={() => onRole("landlord")}>Continue as landlord <ArrowRight size={16} /></Button></div><div className="role-card-art landlord-art"><img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=700&q=85" alt="Modern rental home interior" loading="lazy" /></div></article>
      </div></section>
      <section className="featured-section" id="featured"><div className="featured-heading"><div><p className="eyebrow">LOCAL HOMES, REAL POSSIBILITIES</p><h2>A few places to get you started.</h2><p>Thoughtful rental options around Batangas City.</p></div><button className="text-link" onClick={() => onBrowse("renter")}>Explore all homes <ArrowRight size={16} /></button></div><div className="featured-grid">{properties.filter((property) => property.moderationStatus === "Approved" && !property.isDraft && property.available !== false && (!Number.isInteger(property.units) || property.units > 0)).slice(0, 3).map((property) => <button className="featured-card" key={property.id} onClick={() => onBrowse("renter")}><img src={property.image || fallbackImage} alt={property.name} loading="lazy" /><span className="featured-card-meta"><strong>{property.name}</strong><span>{property.location} · {displayPrice(property)} / {priceUnitLabel(property)}</span></span></button>)}</div></section>
      <section className="match-explainer"><div className="explainer-icon"><Sparkles size={22} /></div><div><p className="eyebrow">A MORE PERSONAL SEARCH</p><h2>Less scrolling. Better matches.</h2><p>Set your budget, choose your neighborhoods, and tell us what matters. RentMatch brings the best-fit homes forward so your search starts with the right details.</p></div><Button variant="outline" onClick={() => onRole("renter")}>Build my preferences <ArrowRight size={16} /></Button></section>
      <section className="faq-section" id="faqs"><div><p className="eyebrow">GOOD TO KNOW</p><h2>Questions, meet answers.</h2><p>We’re here to make the next move clearer.</p><a href="mailto:hello@rentmatch.local"><Mail size={15} /> Contact the RentMatch team</a></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={18} /></summary><p>{answer}</p></details>)}</div></section>
    </main>
    <footer className="public-footer"><Brand onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} inverse /><span>Batangas City, Philippines</span><span>© 2026 RentMatch · Sample experience</span></footer>
  </div>;
}

function AuthScreen({ role, mode, setMode, onRoleChange, onBack, onSubmit, error, onDemo }) {
  const [showPassword, setShowPassword] = useState(false);
  return <div className="auth-page"><header className="auth-header"><Brand onClick={onBack} /><button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to RentMatch</button></header><main className="auth-layout"><div className="auth-visual"><img src={role === "landlord" ? "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85" : "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85"} alt="A calm, light-filled Batangas rental home" /><div><span className="hero-kicker"><Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE</span><h2>{role === "landlord" ? "Good tenants start with a good match." : "A better fit is closer than you think."}</h2><p>Rent thoughtfully. Find your place in Batangas City.</p></div></div><div className="auth-form-wrap"><span className="auth-role-pill">{role === "landlord" ? <Building2 size={14} /> : <Home size={14} />}{role === "landlord" ? "PROPERTY HOST" : "RENTER ACCOUNT"}</span><h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1><p className="auth-subtitle">{mode === "login" ? "Log in to continue to your RentMatch workspace." : `Join RentMatch as a ${role === "landlord" ? "property host" : "renter"}.`}</p>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <form className="auth-form" onSubmit={onSubmit}>
        {mode === "register" && <fieldset className="auth-account-type"><legend>I'm joining as a</legend><label className={role === "renter" ? "selected" : ""}><input type="radio" name="accountType" value="renter" checked={role === "renter"} onChange={() => onRoleChange("renter")} /><Home size={17} /><span>Tenant</span></label><label className={role === "landlord" ? "selected" : ""}><input type="radio" name="accountType" value="landlord" checked={role === "landlord"} onChange={() => onRoleChange("landlord")} /><Building2 size={17} /><span>Landlord</span></label></fieldset>}
        {mode === "register" && <Field label="Full name"><input name="name" autoComplete="name" placeholder="Your full name" required /></Field>}
        <Field label="Email address"><input type="email" name="email" autoComplete="email" placeholder="you@example.com" required /></Field>
        {mode === "register" && <Field label="Contact number"><input type="tel" name="phone" autoComplete="tel" placeholder="+63 9XX XXX XXXX" required /></Field>}
        {mode === "register" && role === "renter" && <Field label="School or university"><input name="school" autoComplete="organization" placeholder="Where do you study?" required /></Field>}
        <Field label="Password" className="password-field"><input type={showPassword ? "text" : "password"} name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" minLength={8} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}><Eye size={16} /></button></Field>
        {mode === "register" && <Field label="Confirm password"><input type="password" name="confirmPassword" autoComplete="new-password" placeholder="Enter your password again" minLength={8} required /></Field>}
        {mode === "register" && role === "renter" && <div className="auth-two-fields"><Field label="Preferred location"><select name="preferredLocation" defaultValue="Poblacion">{locations.slice(1, 5).map((location) => <option key={location}>{location}</option>)}</select></Field><Field label="Monthly budget"><input type="number" name="budget" min="3000" step="500" placeholder="₱ 20,000" required /></Field></div>}
        {mode === "register" && role === "landlord" && <><Field label="Government ID"><span className="upload-field"><Upload size={17} /><span><strong>Choose a file</strong> or drop it here</span><small>JPG, PNG or PDF · verification preview only</small><input type="file" name="governmentId" accept="image/*,.pdf" required /></span></Field><p className="verification-note"><ShieldCheck size={15} /> Your identity review is part of the host verification flow.</p></>}
        {mode === "login" && <div className="auth-options"><label className="check-label"><input type="checkbox" name="remember" defaultChecked /> Remember me</label><button type="button" className="text-link" onClick={() => window.alert("Password reset is available once email delivery is connected.")}>Forgot password?</button></div>}
        <Button type="submit" className="auth-submit">{mode === "login" ? "Log in" : "Create account"} <ArrowRight size={16} /></Button>
      </form>
      <div className="auth-divider"><span>or continue with</span></div><Button variant="outline" className="google-button" onClick={onDemo}><span className="google-mark">G</span> Continue with Google</Button>
      {mode === "login" && <><p className="admin-demo-hint">Admin demo: <strong>{adminDemoAccount.email}</strong> · <strong>{adminDemoAccount.password}</strong></p><p className="admin-demo-hint">Landlord demo: <strong>{landlordDemoAccount.email}</strong> · <strong>{landlordDemoAccount.password}</strong></p></>}
      <p className="auth-switch">{mode === "login" ? "New to RentMatch?" : "Already have an account?"} <button onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create an account" : "Log in"}</button></p><p className="auth-terms">By continuing, you agree to RentMatch's Terms and Privacy Policy.</p>
    </div></main></div>;
}

function AppHeader({ user, view, setView, onLogout, onPreferences, onAdmin, onRoleChange, notifications }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const readNotificationsKey = `rentmatch-read-notifications-${user.email.toLowerCase()}`;
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(readNotificationsKey) || "[]");
    } catch {
      return [];
    }
  });
  const unreadCount = notifications.filter((notification) => !readNotificationIds.includes(notification.id)).length;
  const markNotificationRead = (notification) => {
    const updatedIds = [...new Set([...readNotificationIds, notification.id])].slice(-100);
    setReadNotificationIds(updatedIds);
    localStorage.setItem(readNotificationsKey, JSON.stringify(updatedIds));
    setNotificationsOpen(false);
    setView(notification.view);
  };
  const renterItems = [{ id: "dashboard", label: "Overview", icon: LayoutDashboard }, { id: "search", label: "Find homes", icon: Search }, { id: "applications", label: "Applications", icon: FileText }, { id: "compare", label: "Compare", icon: Scale }, { id: "saved", label: "Saved", icon: Heart }, { id: "maintenance", label: "Maintenance", icon: Wrench }, { id: "messages", label: "Messages", icon: MessageCircle }];
  const hostItems = [{ id: "dashboard", label: "Overview", icon: LayoutDashboard }, { id: "listings", label: "Properties", icon: Building2 }, { id: "applicants", label: "Applicants", icon: Users }, { id: "viewings", label: "Viewings", icon: CalendarDays }, { id: "maintenance", label: "Maintenance", icon: Wrench }, { id: "messages", label: "Messages", icon: MessageCircle }];
  const adminItems = [{ id: "admin", label: "Admin panel", icon: ShieldCheck }];
  const items = user.role === "admin" ? adminItems : user.role === "landlord" ? hostItems : renterItems;
  const titleCase = user.name?.split(" ")[0] || "there";
  return <>
    <header className="app-header"><div className="app-header-inner"><Brand onClick={() => setView(user.role === "admin" ? "admin" : "dashboard")} /><nav className="main-nav" aria-label="Workspace navigation">{items.map(({ id, label, icon: Icon }) => <button key={id} className={view === id || (id === "dashboard" && view === "applications") ? "active" : ""} onClick={() => setView(id)}><Icon size={16} />{label}{id === "compare" && <span className="nav-count">{user.compareCount}</span>}</button>)}</nav><div className="header-tools"><span className="welcome-user">Hi, {titleCase}</span><div className="header-popover-wrap"><button className="icon-button header-icon" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={notificationsOpen}><Bell size={19} />{unreadCount > 0 && <i className="notification-dot" />}</button>{notificationsOpen && <div className="header-popover notification-popover"><strong>Notifications</strong>{notifications.length ? notifications.map((notification) => <button type="button" className={`notification-item ${readNotificationIds.includes(notification.id) ? "" : "unread"}`} key={notification.id} onClick={() => markNotificationRead(notification)}><span className="notification-bullet" /><span><b>{notification.title}</b><small>{notification.detail}</small></span></button>) : <p className="notification-empty">No new viewing notifications.</p>}</div>}</div><div className="header-popover-wrap"><button className="profile-trigger" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }} aria-label="Open profile menu" aria-expanded={profileOpen}><span className="profile-initial">{user.name?.charAt(0)?.toUpperCase() || "R"}</span><ChevronDown size={14} /></button>{profileOpen && <div className="header-popover profile-popover"><div className="profile-popover-person"><span className="profile-initial">{user.name?.charAt(0)?.toUpperCase() || "R"}</span><span><strong>{user.name || "RentMatch member"}</strong><small>{user.role === "admin" ? "Administrator" : user.role === "landlord" ? "Property host" : "Renter"}</small></span></div>{user.role !== "admin" && <button onClick={() => { setProfileOpen(false); onPreferences(); }}><Settings size={15} /> Preferences & profile</button>}{user.role === "admin" && <button onClick={() => { setProfileOpen(false); onAdmin(); }}><ShieldCheck size={15} /> Admin panel</button>}<button onClick={() => { setProfileOpen(false); onRoleChange(); }}><Users size={15} /> Sign out and switch</button><button onClick={onLogout}><LogOut size={15} /> Sign out</button></div>}</div></div></div></header>
    <nav className="mobile-nav" aria-label="Mobile workspace navigation">{items.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon size={19} /><span>{label}</span></button>)}</nav>
  </>;
}

function StatCard({ icon: Icon, label, value, note, tone = "blue" }) {
  return <article className="stat-card"><span className={`stat-icon tone-${tone}`}><Icon size={19} /></span><div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></div></article>;
}

function EmptyState({ icon: Icon = Search, title, detail, action, onAction }) {
  return <div className="empty-panel"><span><Icon size={23} /></span><h3>{title}</h3><p>{detail}</p>{action && <Button onClick={onAction}>{action} <ArrowRight size={15} /></Button>}</div>;
}

function HomeDashboard({ user, properties, preferences, favorites, applications, viewings, onNavigate, onOpen, onSave, onCompare, compareIds, getScore }) {
  const matches = properties.map((property) => ({ property, score: getScore(property) })).sort((a, b) => b.score - a.score).slice(0, 3);
  return <div className="workspace-content dashboard-content"><section className="dashboard-welcome"><div><p className="eyebrow">YOUR RENTAL SEARCH, MADE PERSONAL</p><h1>Welcome back, {user.name?.split(" ")[0] || "there"}.</h1><p>We found places that are a little closer to what you’re looking for.</p></div><Button onClick={() => onNavigate("preferences")}><SlidersHorizontal size={16} /> Tune my match</Button></section>
    <div className="stat-grid"><StatCard icon={Sparkles} label="Matched homes" value={properties.length} note="Based on your preferences" tone="blue" /><StatCard icon={Heart} label="Saved homes" value={favorites.length} note="Your shortlist" tone="rose" /><StatCard icon={FileText} label="Applications" value={applications.length} note={applications.length ? "Status updates inside" : "Ready when you are"} tone="green" /><StatCard icon={CalendarDays} label="Viewings" value={viewings.length} note={viewings.length ? "Upcoming appointments" : "Schedule from a listing"} tone="amber" /></div>
    <section className="dashboard-section"><div className="subsection-heading"><div><p className="eyebrow">YOUR TOP MATCHES</p><h2>Places worth a closer look</h2></div><button className="text-link" onClick={() => onNavigate("search")}>See all matches <ArrowRight size={15} /></button></div><div className="property-grid">{matches.map(({ property, score }) => <PropertyCard key={property.id} property={property} score={score} saved={favorites.includes(property.id)} compared={compareIds.includes(property.id)} onSave={() => onSave(property.id)} onCompare={() => onCompare(property.id)} onOpen={() => onOpen(property)} />)}</div></section>
    <section className="dashboard-lower"><button className="preference-summary" onClick={() => onNavigate("preferences")}><div className="preference-summary-top"><span className="summary-icon"><SlidersHorizontal size={17} /></span><span className="text-link">Edit <ArrowRight size={14} /></span></div><p className="eyebrow">YOUR MATCH PROFILE</p><h3>Made around your must-haves.</h3><p>{preferences.location === "All locations" ? "Anywhere in Batangas City" : preferences.location} · Up to {currency.format(preferences.budget)}/mo{preferences.amenities?.length ? ` · ${preferences.amenities.slice(0, 2).join(", ")}` : ""}</p></button><button className="dashboard-prompt" onClick={() => onNavigate("applications")}><span className="prompt-icon"><CalendarDays size={18} /></span><div><strong>Planning your next step?</strong><span>Keep track of viewing schedules and rental applications in one place.</span></div><ChevronRight size={18} /></button></section>
  </div>;
}

function SearchPage({
  properties,
  filters,
  setFilters,
  favorites,
  compareIds,
  onSave,
  onCompare,
  onOpen,
  getScore,
  onToast,
}) {
  const filtered = properties
    .filter((property) => {
      const locationMatch =
        filters.location === "All locations" ||
        (filters.location === "Other areas"
          ? !["Poblacion", "Kumintang", "Alangilan", "Balagtas"].some((area) =>
              property.location.includes(area),
            )
          : property.location
              .toLowerCase()
              .includes(filters.location.toLowerCase()));
      const searchMatch =
        !filters.query ||
        `${property.name} ${property.location} ${property.type}`
          .toLowerCase()
          .includes(filters.query.toLowerCase());
      const typeMatch =
        filters.type === "All types" || property.type === filters.type;
      const amenitiesMatch = filters.amenities.every((amenity) =>
        property.amenities.includes(amenity),
      );
      const priceMatch = property.priceOptions?.length
        ? property.priceOptions.some((option) => option.price <= Number(filters.maxPrice))
        : property.price <= Number(filters.maxPrice);
      return (
        locationMatch &&
        searchMatch &&
        typeMatch &&
        amenitiesMatch &&
        priceMatch &&
        property.bedrooms >= Number(filters.bedrooms) &&
        (!filters.availableOnly || (property.available === true && Number.isInteger(property.units)))
      );
    })
    .sort((a, b) => getScore(b) - getScore(a));
  const activeFilters =
    Number(filters.maxPrice) < 30000 ||
    filters.type !== "All types" ||
    filters.location !== "All locations" ||
    filters.amenities.length > 0 ||
    Number(filters.bedrooms) > 0 ||
    filters.availableOnly;
  const toggleAmenity = (amenity) =>
    setFilters({
      ...filters,
      amenities: filters.amenities.includes(amenity)
        ? filters.amenities.filter((item) => item !== amenity)
        : [...filters.amenities, amenity],
    });
  return (
    <div className="workspace-content search-content">
      <SectionHeading
        eyebrow="FIND YOUR NEXT PLACE"
        title="Homes around Batangas City"
        detail="Browse local rentals and see how well each one fits."
        action={
          <span className="listing-counter">{filtered.length} homes</span>
        }
      />
      <div className="search-toolbar">
        <label className="rental-search">
          <Search size={18} />
          <input
            value={filters.query}
            onChange={(event) =>
              setFilters({ ...filters, query: event.target.value })
            }
            placeholder="Search a neighborhood, home, or property type"
            aria-label="Search rentals"
          />
          {filters.query && (
            <button
              className="icon-button"
              onClick={() => setFilters({ ...filters, query: "" })}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </label>
        <Button
          variant="outline"
          onClick={() =>
            onToast("Map preview is ready for a map provider integration.")
          }
        >
          <MapIcon size={16} /> Map view
        </Button>
      </div>
      <div className="search-layout">
        <aside className="filter-panel">
          <div className="filter-panel-heading">
            <h2>
              <SlidersHorizontal size={16} /> Filters
            </h2>
            {activeFilters && (
              <button
                className="text-link"
                onClick={() =>
                  setFilters({
                    ...filters,
                    location: "All locations",
                    type: "All types",
                    amenities: [],
                    maxPrice: 30000,
                    bedrooms: 0,
                    availableOnly: false,
                  })
                }
              >
                Clear
              </button>
            )}
          </div>
          <Field label="Location">
            <select
              value={filters.location}
              onChange={(event) =>
                setFilters({ ...filters, location: event.target.value })
              }
            >
              {locations.map((location) => (
                <option key={location}>{location}</option>
              ))}
            </select>
          </Field>
          <Field label="Property type">
            <select
              value={filters.type}
              onChange={(event) =>
                setFilters({ ...filters, type: event.target.value })
              }
            >
              {propertyTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </Field>
          <div className="filter-control">
            <label htmlFor="rent-range">
              Monthly budget{" "}
              <strong>Up to {currency.format(filters.maxPrice)}</strong>
            </label>
            <input
              id="rent-range"
              type="range"
              min="5000"
              max="30000"
              step="500"
              value={filters.maxPrice}
              onChange={(event) =>
                setFilters({ ...filters, maxPrice: event.target.value })
              }
            />
          </div>
          <Field label="Bedrooms">
            <select
              value={filters.bedrooms}
              onChange={(event) =>
                setFilters({ ...filters, bedrooms: Number(event.target.value) })
              }
            >
              <option value="0">Any</option>
              <option value="1">1 or more</option>
              <option value="2">2 or more</option>
              <option value="3">3 or more</option>
            </select>
          </Field>
          <div className="amenity-filter">
            <span className="filter-label">Amenities</span>
            {amenityOptions.map((amenity) => (
              <label className="check-label" key={amenity}>
                <input
                  type="checkbox"
                  checked={filters.amenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                />
                {amenity}
              </label>
            ))}
          </div>
          <label className="check-label available-check">
            <input
              type="checkbox"
              checked={filters.availableOnly}
              onChange={(event) =>
                setFilters({ ...filters, availableOnly: event.target.checked })
              }
            />
            Available now
          </label>
        </aside>
        <div className="search-results">
          <div className="results-heading">
            <span>Sorted by best match</span>
            <span className="sort-indicator">
              <Sparkles size={14} /> Personalized results
            </span>
          </div>
          {filtered.length ? (
            <div className="property-grid">
              {filtered.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  score={getScore(property)}
                  saved={favorites.includes(property.id)}
                  compared={compareIds.includes(property.id)}
                  onSave={() => onSave(property.id)}
                  onCompare={() => onCompare(property.id)}
                  onOpen={() => onOpen(property)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="No homes match those filters"
              detail="Try a wider budget or remove one of your filters."
              action="Clear filters"
              onAction={() =>
                setFilters({
                  query: "",
                  location: "All locations",
                  type: "All types",
                  amenities: [],
                  maxPrice: 30000,
                  bedrooms: 0,
                  availableOnly: false,
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ComparisonPage({
  properties,
  compareIds,
  onRemove,
  onBrowse,
  getScore,
  onOpen,
}) {
  const compareHomes = compareIds
    .map((id) => properties.find((property) => property.id === id))
    .filter(Boolean);
  if (!compareHomes.length)
    return (
      <div className="workspace-content">
        <SectionHeading
          eyebrow="MAKE THE DETAILS CLEAR"
          title="Compare homes"
          detail="Put your shortlist side by side and see what stands out."
        />
        <EmptyState
          icon={Scale}
          title="Your comparison is ready when you are"
          detail="Add up to three homes from search to compare rent, features, location, and your match score."
          action="Find homes"
          onAction={onBrowse}
        />
      </div>
    );
  const samePriceBasis = compareHomes.every(
    (home) =>
      (home.priceBasis || "monthly") ===
      (compareHomes[0].priceBasis || "monthly"),
  );
  const bestPrice = samePriceBasis
    ? Math.min(...compareHomes.map((property) => property.price))
    : null;
  const bestMatch = Math.max(
    ...compareHomes.map((property) => getScore(property)),
  );
  const rows = [
    {
      label: "Listed price",
      value: (home) => `${displayPrice(home)} / ${priceUnitLabel(home)}`,
      best: (home) => bestPrice != null && home.price === bestPrice,
    },
    { label: "Location", value: (home) => home.location },
    { label: "Property type", value: (home) => home.type },
    {
      label: "Bedrooms",
      value: (home) =>
        `${home.bedrooms} bedroom${home.bedrooms > 1 ? "s" : ""}`,
    },
    {
      label: "Bathrooms",
      value: (home) =>
        `${home.bathrooms} bathroom${home.bathrooms > 1 ? "s" : ""}`,
    },
    {
      label: "Security deposit",
      value: (home) =>
        home.deposit == null ? "Not provided" : currency.format(home.deposit),
    },
    { label: "Amenities", value: (home) => home.amenities.join(", ") },
    { label: "Nearby", value: (home) => home.distance },
    {
      label: "Rating",
      value: (home) =>
        home.rating ? `★ ${home.rating} (${home.reviews})` : "Not rated yet",
    },
    {
      label: "Availability",
      value: (home) => unitAvailabilityLabel(home),
    },
    {
      label: "Your match",
      value: (home) => `${getScore(home)}%`,
      best: (home) => getScore(home) === bestMatch,
    },
  ];
  return (
    <div className="workspace-content">
      <SectionHeading
        eyebrow="MAKE THE DETAILS CLEAR"
        title="Compare homes"
        detail={`${compareHomes.length} of 3 homes in your comparison.`}
        action={
          <Button variant="outline" onClick={onBrowse}>
            <Plus size={15} /> Add a home
          </Button>
        }
      />
      <div className="comparison-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>At a glance</th>
              {compareHomes.map((home) => (
                <th key={home.id}>
                  <div className="compare-home">
                    <button onClick={() => onOpen(home)}>
                      <img src={home.image} alt="" />
                      <span>
                        <strong>{home.name}</strong>
                        <small>{home.location}</small>
                      </span>
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => onRemove(home.id)}
                      aria-label={`Remove ${home.name} from comparison`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th>{row.label}</th>
                {compareHomes.map((home) => (
                  <td
                    key={home.id}
                    className={row.best?.(home) ? "best-cell" : ""}
                  >
                    {row.best?.(home) && <CheckCircle2 size={15} />}
                    {row.value(home)}
                    {row.label === "Listed price" && row.best?.(home) && (
                      <span className="best-value">Best value</span>
                    )}
                    {row.label === "Your match" && row.best?.(home) && (
                      <span className="best-value">Highest match</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="comparison-note">
        <Sparkles size={16} />
        <span>
          Rent is only one part of a good fit. Use your preferences and viewing
          to confirm the details that matter most.
        </span>
      </div>
    </div>
  );
}

function SavedPage({
  properties,
  favorites,
  onSave,
  onCompare,
  compareIds,
  onOpen,
  getScore,
  onBrowse,
}) {
  const savedHomes = favorites
    .map((id) => properties.find((property) => property.id === id))
    .filter(Boolean);
  return (
    <div className="workspace-content">
      <SectionHeading
        eyebrow="YOUR SHORTLIST"
        title="Saved homes"
        detail="Keep the places you like close while you decide."
        action={
          <span className="listing-counter">{savedHomes.length} saved</span>
        }
      />
      {savedHomes.length ? (
        <div className="property-grid saved-grid">
          {savedHomes.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              score={getScore(property)}
              saved
              compared={compareIds.includes(property.id)}
              onSave={() => onSave(property.id)}
              onCompare={() => onCompare(property.id)}
              onOpen={() => onOpen(property)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Heart}
          title="Your shortlist starts here"
          detail="Save a home you like and it will be waiting here when you come back."
          action="Browse homes"
          onAction={onBrowse}
        />
      )}
    </div>
  );
}

function PreferencesPage({ preferences, setPreferences, onToast }) {
  const toggle = (key, value) => setPreferences({ ...preferences, [key]: preferences[key].includes(value) ? preferences[key].filter((item) => item !== value) : [...preferences[key], value] });
  return <div className="workspace-content preference-page"><SectionHeading eyebrow="SMART MATCHING" title="Your rental preferences" detail="A few details help us surface homes that fit your life." /><div className="preference-layout"><form className="preference-form" onSubmit={(event) => { event.preventDefault(); onToast("Your preferences are saved. Matches have been updated."); }}><Field label="Preferred location"><select value={preferences.location} onChange={(event) => setPreferences({ ...preferences, location: event.target.value })}>{locations.map((location) => <option key={location}>{location}</option>)}</select></Field><div className="filter-control preference-budget"><label htmlFor="pref-budget">Monthly budget <strong>{currency.format(preferences.budget)}</strong></label><input id="pref-budget" type="range" min="5000" max="40000" step="500" value={preferences.budget} onChange={(event) => setPreferences({ ...preferences, budget: Number(event.target.value) })} /><div className="range-ends"><span>₱5,000</span><span>₱40,000+</span></div></div><fieldset><legend>What kind of place?</legend><div className="choice-grid">{propertyTypes.slice(1).map((type) => <label key={type} className={`choice-chip ${preferences.types.includes(type) ? "selected" : ""}`}><input type="checkbox" checked={preferences.types.includes(type)} onChange={() => toggle("types", type)} />{type}</label>)}</div></fieldset><fieldset><legend>Your must-have amenities</legend><div className="choice-grid">{amenityOptions.map((amenity) => <label key={amenity} className={`choice-chip ${preferences.amenities.includes(amenity) ? "selected" : ""}`}><input type="checkbox" checked={preferences.amenities.includes(amenity)} onChange={() => toggle("amenities", amenity)} />{amenity}</label>)}</div></fieldset><Field label="Nearby matters"><select value={preferences.distance} onChange={(event) => setPreferences({ ...preferences, distance: event.target.value })}><option>Any distance</option><option>Near schools</option><option>Near workplaces</option><option>Near transport</option></select></Field><Button type="submit"><Check size={16} /> Save preferences</Button></form><aside className="match-preview"><div className="preview-orbit"><Sparkles size={26} /></div><p className="eyebrow">MATCH PREVIEW</p><h2>Your priorities, built in.</h2><p>Your match score weighs location, budget, property type, and the amenities you select.</p><div className="preview-sample"><span className="preview-score">95%</span><span><strong>The Poblacion Loft</strong><small>Strong fit for your preferences</small></span><CheckCircle2 size={18} /></div><Button variant="outline" onClick={() => onToast("Preference-based matching is active across your search results.")}>How matching works <CircleHelp size={15} /></Button></aside></div></div>;
}

function ApplicationsPage({ applications, viewings, properties, onBrowse }) {
  return <div className="workspace-content"><SectionHeading eyebrow="YOUR NEXT STEPS" title="Applications & viewings" detail="Stay up to date from first inquiry to move-in." action={<Button variant="outline" onClick={onBrowse}><Search size={15} /> Find a home</Button>} /><div className="applications-layout"><section className="surface-panel"><div className="surface-panel-heading"><div><h2>Rental applications</h2><p>Updates from the homes you applied to.</p></div><span className="panel-count">{applications.length}</span></div>{applications.length ? <div className="activity-list">{applications.map((application) => { const home = properties.find((item) => item.id === application.propertyId); return <article className="activity-row" key={application.id}><span className="activity-icon"><FileText size={17} /></span><span><strong>{home?.name || application.propertyName}</strong><small>Applied {application.date}</small></span><span className={`status-pill status-${application.status.toLowerCase().replaceAll(" ", "-")}`}>{application.status}</span></article>; })}</div> : <div className="panel-empty">No active applications yet. When you apply to a home, its status will show here.</div>}</section><section className="surface-panel"><div className="surface-panel-heading"><div><h2>Scheduled viewings</h2><p>Meet a host and see a place in person.</p></div><span className="panel-count">{viewings.length}</span></div>{viewings.length ? <div className="activity-list">{viewings.map((viewing) => { const home = properties.find((item) => item.id === viewing.propertyId); const status = viewing.status || "Pending"; return <article className="activity-row viewing-activity-row" key={viewing.id}><span className="activity-icon activity-icon-amber"><CalendarDays size={17} /></span><span><strong>{home?.name || viewing.propertyName}</strong><small>{viewing.date} · {viewing.requestedTime || viewing.time}</small>{viewing.hostComment && <small className="viewing-host-comment">Host: {viewing.hostComment}</small>}</span><span className={`status-pill status-${status === "Available" ? "approved" : status === "Unavailable" ? "declined" : "pending"}`}>{status}</span></article>; })}</div> : <div className="panel-empty">No viewings scheduled. Choose a home and request a time that works for you.</div>}</section></div></div>;
}

function MaintenanceRequestsPage({ mode, requests, properties, onCreate, onUpdateStatus, onRemove }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isLandlord = mode === "landlord";
  const submit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setSubmitting(true);
    const values = new FormData(event.currentTarget);
    try {
      await onCreate({
        propertyId: values.get("propertyId"),
        category: values.get("category"),
        title: values.get("title")?.toString().trim(),
        description: values.get("description")?.toString().trim(),
        priority: values.get("priority"),
      });
      form.reset();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };
  const dateLabel = (value) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(value));

  return <div className="workspace-content maintenance-content">
    <SectionHeading
      eyebrow={isLandlord ? "PROPERTY CARE" : "YOUR RENTAL"}
      title="Maintenance requests"
      detail={isLandlord ? "Review renter-reported issues and keep each repair moving." : "Report a repair or property issue directly to your landlord."}
      action={<span className="listing-counter"><Wrench size={14} /> {requests.length} {requests.length === 1 ? "request" : "requests"}</span>}
    />
    {!isLandlord && <section className="surface-panel maintenance-form-panel">
      <div className="surface-panel-heading"><div><h2>Submit a maintenance request</h2><p>Your landlord will receive the issue and your contact details.</p></div><span className="activity-icon"><Wrench size={17} /></span></div>
      <form className="maintenance-form" onSubmit={submit}>
        <Field label="Rental property"><select name="propertyId" defaultValue="" required><option value="" disabled>Select the rental where you are staying</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.location}</option>)}</select></Field>
        <Field label="Issue category"><select name="category" defaultValue="General repair" required><option>General repair</option><option>Plumbing</option><option>Electrical</option><option>Appliance</option><option>Pest control</option><option>Other</option></select></Field>
        <Field label="Short title"><input name="title" maxLength={120} placeholder="e.g. Leaking kitchen faucet" required /></Field>
        <Field label="Priority"><select name="priority" defaultValue="Routine" required><option>Routine</option><option>Urgent</option></select></Field>
        <Field label="Describe the issue" className="maintenance-description"><textarea name="description" rows={4} maxLength={1500} placeholder="Tell your landlord what happened and where to find the issue." required /></Field>
        {error && <p className="maintenance-error" role="alert">{error}</p>}
        <div className="maintenance-submit"><Button type="submit" disabled={submitting}><Send size={15} /> {submitting ? "Sending request..." : "Send to landlord"}</Button><small>For immediate danger, contact local emergency services.</small></div>
      </form>
    </section>}
    <section className={`maintenance-list ${isLandlord ? "landlord-maintenance-list" : ""}`}>
      <div className="subsection-heading"><div><p className="eyebrow">{isLandlord ? "INCOMING FROM RENTERS" : "REQUEST HISTORY"}</p><h2>{isLandlord ? "Requests for your properties" : "Your submitted requests"}</h2></div></div>
      {requests.length ? requests.map((request) => <article className="surface-panel maintenance-card" key={request.id}>
        <div className="maintenance-card-top"><span className="activity-icon"><Wrench size={17} /></span><div className="maintenance-card-title"><strong>{request.title}</strong><small>{request.propertyName} · {request.category}</small></div><span className={`status-pill status-${request.status.toLowerCase().replaceAll(" ", "-")}`}>{request.status}</span></div>
        <p className="maintenance-description-text">{request.description}</p>
        <div className="maintenance-meta"><span>{isLandlord ? `From ${request.renterName} · ${request.renterEmail}` : `Sent to ${request.landlordName}`}</span><span>{dateLabel(request.createdAt)}</span>{request.priority === "Urgent" && <span className="maintenance-urgent">Urgent</span>}{!isLandlord && <Button variant="ghost" size="small" className="maintenance-remove" onClick={() => onRemove(request)} aria-label={`Remove maintenance request: ${request.title}`}><Trash2 size={14} /> Remove request</Button>}</div>
        {isLandlord && <label className="maintenance-status-control"><span>Update status</span><select value={request.status} onChange={(event) => onUpdateStatus(request.id, event.target.value)} aria-label={`Update status for ${request.title}`}><option>Received</option><option>In progress</option><option>Completed</option></select></label>}
      </article>) : <div className="surface-panel maintenance-empty"><span className="activity-icon"><Wrench size={18} /></span><strong>{isLandlord ? "No maintenance requests yet" : "No requests submitted yet"}</strong><p>{isLandlord ? "Renter reports for your properties will appear here." : "Use the form above to let your landlord know when something needs attention."}</p></div>}
    </section>
  </div>;
}

function MessagesPage({ messages, setMessages, user, properties, onToast, activePerson: initialPerson }) {
  const people = [...new Set(messages.map((message) => message.person).filter((person) => person && person !== user.name))];
  const fallbackPerson = people[0] || "Maya Santos";
  const [activePerson, setActivePerson] = useState(initialPerson || fallbackPerson);
  const [draft, setDraft] = useState("");
  useEffect(() => {
    if (initialPerson && initialPerson !== user.name) setActivePerson(initialPerson);
  }, [initialPerson, user.name]);
  const selectedPerson = people.includes(activePerson) ? activePerson : fallbackPerson;
  const currentMessages = messages.filter((message) => message.person === selectedPerson);
  const conversationProperty = properties.find((property) => property.id === currentMessages.findLast((message) => message.propertyId)?.propertyId)
    || properties.find((property) => property.name === currentMessages.findLast((message) => message.property)?.property)
    || properties[0];
  const send = (event) => {
    event.preventDefault();
    if (!draft.trim() || !selectedPerson) return;
    const text = draft.trim();
    const stamp = Date.now();
    setMessages((current) => [
      ...current,
      { id: `${stamp}-me`, person: selectedPerson, from: user.name, sender: "me", text, time: "Just now", propertyId: conversationProperty?.id, property: conversationProperty?.name },
      { id: `${stamp}-them`, person: user.name, from: user.name, sender: "them", text, time: "Just now", propertyId: conversationProperty?.id, property: conversationProperty?.name },
    ]);
    setDraft("");
  };
  return <div className="workspace-content messages-content"><SectionHeading eyebrow="KEEP THE CONVERSATION GOING" title="Messages" detail="Talk through details, ask a question, or plan a viewing." /><div className="chat-layout"><aside className="conversation-list"><div className="conversation-search"><Search size={15} /><input aria-label="Search conversations" placeholder="Search messages" /></div>{people.map((person) => <button key={person} className={`conversation-item ${person === selectedPerson ? "active" : ""}`} onClick={() => setActivePerson(person)}><span className="conversation-avatar">{person.charAt(0)}</span><span><strong>{person}</strong><small>{messages.findLast((message) => message.person === person)?.text || "Start a conversation"}</small></span><span className="conversation-time">Now</span></button>)}</aside><section className="chat-panel"><header className="chat-header"><span className="conversation-avatar">{selectedPerson.charAt(0)}</span><span><strong>{selectedPerson}</strong><small><i /> Usually replies within a day</small></span><button className="icon-button" aria-label="Contact details" onClick={() => onToast("Contact details are shared after a host responds to your inquiry.")}><MoreHorizontal size={20} /></button></header><div className="chat-property-context"><img src={conversationProperty?.image || fallbackImage} alt="" /><span><small>ABOUT THE LISTING</small><strong>{conversationProperty?.name || "Rental inquiry"}</strong></span><span className="chat-context-price">{currency.format(conversationProperty?.price || 0)}<small> / month</small></span></div><div className="chat-messages" aria-live="polite">{currentMessages.length ? currentMessages.map((message) => <div key={message.id} className={`chat-message ${(message.sender === "me" || (!message.sender && message.from === user.name)) ? "mine" : "theirs"}`}><p>{message.text}</p><small>{message.time}</small></div>) : <div className="chat-start"><MessageCircle size={22} /><p>Say hello to {selectedPerson} about a rental.</p></div>}</div><form className="chat-compose" onSubmit={send}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message..." aria-label="Write a message" /><Button type="submit" aria-label="Send message"><Send size={16} /></Button></form><p className="chat-disclaimer">Messages are saved in this browser for this demo.</p></section></div></div>;
}

function HostViewingRequests({ viewings, properties, onRespond }) {
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const requests = viewings.filter((viewing) => propertyById.has(viewing.propertyId));
  return (
    <div className="workspace-content">
      <SectionHeading eyebrow="VIEWING REQUESTS" title="Renter viewing requests" detail="Review proposed dates and times, then confirm availability with a message." />
      {requests.length ? (
        <div className="host-viewing-list">
          {requests.map((request) => (
            <HostViewingRequest key={request.id} request={request} property={propertyById.get(request.propertyId)} onRespond={onRespond} />
          ))}
        </div>
      ) : (
        <EmptyState icon={CalendarDays} title="No viewing requests yet" detail="Requests from renters for your properties will appear here." />
      )}
    </div>
  );
}

function HostViewingRequest({ request, property, onRespond }) {
  const [response, setResponse] = useState(request.hostComment || "");
  const [error, setError] = useState("");
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(request.date)
    ? new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(new Date(`${request.date}T00:00:00`))
    : request.date;
  const submitResponse = (status) => {
    if (!response.trim()) {
      setError("Add a comment for the renter before sending your response.");
      return;
    }
    setError("");
    onRespond(request, status, response.trim());
  };
  return (
    <article className="surface-panel host-viewing-card">
      <div className="host-viewing-heading">
        <span className="activity-icon activity-icon-amber"><CalendarDays size={17} /></span>
        <div><strong>{property.name}</strong><small>Request from {request.renterName || "Renter"} · {request.renterEmail || "Email not provided"}</small></div>
        <span className={`status-pill status-${(request.status || "Pending").toLowerCase()}`}>{request.status || "Pending"}</span>
      </div>
      <div className="host-viewing-details">
        <span><strong>Requested date</strong>{dateLabel}</span>
        <span><strong>Requested time</strong>{request.requestedTime || request.time || "Not specified"}</span>
      </div>
      {request.renterMessage && <p className="host-viewing-note"><strong>Renter message</strong>{request.renterMessage}</p>}
      {request.hostComment && <p className="host-viewing-note host-viewing-response"><strong>Your latest message</strong>{request.hostComment}</p>}
      <div className="host-viewing-reply">
        <label htmlFor={`viewing-reply-${request.id}`}>Message to renter</label>
        <textarea id={`viewing-reply-${request.id}`} value={response} onChange={(event) => setResponse(event.target.value)} rows={2} placeholder="Add a comment about your availability or suggest another time." />
        {error && <p className="form-alert" role="alert">{error}</p>}
        <div>
          <Button type="button" onClick={() => submitResponse("Available")}><Check size={14} /> Confirm available</Button>
          <Button type="button" variant="outline" onClick={() => submitResponse("Unavailable")}><X size={14} /> Not available</Button>
        </div>
      </div>
    </article>
  );
}

function PropertyDetails({
  property,
  score,
  saved,
  compared,
  viewingRequested,
  onClose,
  onSave,
  onCompare,
  onApply,
  onSchedule,
  onMessage,
}) {
  const [applied, setApplied] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const propertyImages = property.images?.length
    ? property.images
    : [property.image || fallbackImage];
  const hasExactPin = Number.isFinite(property.latitude)
    && Number.isFinite(property.longitude)
    && property.latitude >= -90
    && property.latitude <= 90
    && property.longitude >= -180
    && property.longitude <= 180;
  const mapCoordinates = hasExactPin ? `${property.latitude},${property.longitude}` : "";
  const mapEmbedUrl = hasExactPin
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapCoordinates)}&z=18&output=embed`
    : null;
  const mapDirectionsUrl = hasExactPin
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapCoordinates)}`
    : property.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address || property.location || "Batangas City")}`;
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
      if (propertyImages.length > 1 && event.key === "ArrowLeft") {
        setActiveImage((current) => (current - 1 + propertyImages.length) % propertyImages.length);
      }
      if (propertyImages.length > 1 && event.key === "ArrowRight") {
        setActiveImage((current) => (current + 1) % propertyImages.length);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, propertyImages.length]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="property-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={20} />
        </button>
        <div className={`modal-gallery ${propertyImages.length > 1 ? "has-gallery" : ""}`}>
          <div className="gallery-main">
            <img
              src={propertyImages[activeImage]}
              alt={`${property.name} photo ${activeImage + 1}`}
            />
            {propertyImages.length > 1 && (
              <>
                <button
                  className="gallery-nav gallery-previous"
                  type="button"
                  onClick={() => setActiveImage((current) => (current - 1 + propertyImages.length) % propertyImages.length)}
                  aria-label="Previous photo"
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  className="gallery-nav gallery-next"
                  type="button"
                  onClick={() => setActiveImage((current) => (current + 1) % propertyImages.length)}
                  aria-label="Next photo"
                >
                  <ArrowRight size={18} />
                </button>
                <span className="gallery-counter" aria-live="polite">{activeImage + 1} / {propertyImages.length}</span>
              </>
            )}
          </div>
          {propertyImages.length > 1 ? (
            <div className="gallery-side gallery-side-thumbnails">
              {propertyImages.slice(1).map((image, index) => (
                <button
                  key={image}
                  className={`gallery-thumb ${activeImage === index + 1 ? "active" : ""}`}
                  type="button"
                  onClick={() => setActiveImage(index + 1)}
                  aria-label={`View ${property.name} photo ${index + 2}`}
                  aria-pressed={activeImage === index + 1}
                >
                  <img
                    src={image}
                    alt={`${property.name} photo ${index + 2}`}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="gallery-side">
              <div className="gallery-thumb">
                <img
                  src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=650&q=85"
                  alt="Rental living area"
                />
              </div>
              <div className="virtual-tour">
                <Eye size={20} />
                <strong>Virtual tour</strong>
                <span>Preview coming soon</span>
              </div>
            </div>
          )}
        </div>
        <div className="modal-content">
          <div className="modal-intro">
            <div>
              <span className="eyebrow">
                {property.type.toUpperCase()} · BATANGAS CITY
              </span>
              <h2 id="property-dialog-title">{property.name}</h2>
              <p>
                <MapPin size={15} /> {property.address}
              </p>
            </div>
            <MatchBadge score={score} />
          </div>
          <div className="modal-facts">
            <span>
              <BedDouble size={17} /> {property.bedrooms} bedroom
              {property.bedrooms > 1 ? "s" : ""}
            </span>
            <span>
              <Bath size={17} /> {property.bathrooms} bathroom
              {property.bathrooms > 1 ? "s" : ""}
            </span>
            <span>
              <Star size={16} fill="currentColor" /> {property.rating
                ? `${property.rating} · ${property.reviews} reviews`
                : "Not rated yet"}
            </span>
            <span>
              <Building2 size={16} /> {unitAvailabilityLabel(property)}
            </span>
          </div>
          <div className="modal-info-grid">
            <div>
              <h3>About this home</h3>
              <p>{property.description}</p>
              {(property.capacity || property.includedUtilities?.length || property.additionalCosts?.length || property.houseRules?.length) && (
                <div className="listing-detail-list">
                  <h3>Listing details</h3>
                  {property.capacity && <p><strong>Capacity / room setup:</strong> {property.capacity}</p>}
                  {property.includedUtilities?.length > 0 && <p><strong>Included:</strong> {property.includedUtilities.join(", ")}</p>}
                  {property.additionalCosts?.length > 0 && <p><strong>Additional costs:</strong> {property.additionalCosts.join(" ")}</p>}
                  {property.houseRules?.length > 0 && <p><strong>House rules:</strong> {property.houseRules.join("; ")}</p>}
                </div>
              )}
              <p className="nearby-info">
                <MapPin size={15} /> {property.distance}
              </p>
              {property.mapUrl && (
                <a className="property-map-link" href={property.mapUrl} target="_blank" rel="noreferrer">
                  <MapIcon size={14} /> Open in Google Maps <ArrowRight size={13} />
                </a>
              )}
              {property.occupancyRestriction && (
                <p className="eligibility-note"><ShieldCheck size={14} /> {property.occupancyRestriction}</p>
              )}
              <h3>Amenities</h3>
              <div className="amenity-list">
                {(property.amenityDetails || property.amenities).map((amenity) => (
                  <span key={amenity}>
                    <Check size={14} />
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
            <aside className="host-card">
              <div className="host-person">
                <span className="host-avatar">
                  {property.host?.charAt(0) || "H"}
                </span>
                <span>
                  <strong>
                    Hosted by {property.host || "Local property host"}
                  </strong>
                  <small>
                    {property.hostSince || "Verified RentMatch host"}
                  </small>
                </span>
                <ShieldCheck size={17} />
              </div>
              <p>{property.description.slice(0, 120)}...</p>
              <div className="host-contact">
                <span>
                  <Phone size={14} /> Contact details shared after inquiry
                </span>
              </div>
            </aside>
          </div>
          <section className="property-map-section" aria-labelledby="property-map-title">
            <div className="property-map-heading">
              <div>
                <h3 id="property-map-title">Property location</h3>
                <p><MapPin size={14} /> {property.address || property.location || "Batangas City"}</p>
              </div>
              <a href={mapDirectionsUrl} target="_blank" rel="noreferrer">
                <MapIcon size={14} /> Get directions <ArrowRight size={13} />
              </a>
            </div>
            {mapEmbedUrl ? (
              <iframe
                title={`Google Maps location for ${property.name}`}
                src={mapEmbedUrl}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <div className="property-map-empty">
                <MapPin size={20} />
                <strong>Exact map pin not set</strong>
                <span>The host needs to add this property's latitude and longitude.</span>
              </div>
            )}
            <p className="property-map-note">
              {hasExactPin
                ? `Exact Google Maps pin: ${property.latitude}, ${property.longitude}.`
                : "This listing is not pinned yet; the address alone may only identify a neighborhood."}
            </p>
          </section>
          <div className="modal-bottom">
            <div className={property.priceOptions?.length ? "modal-price-options" : ""}>
              {property.priceOptions?.length ? property.priceOptions.map((option) => (
                <span className="price-option" key={option.label}>
                  <strong>{currency.format(option.price)}</strong>
                  <span>{option.label}</span>
                </span>
              )) : <><strong>{currency.format(property.price)}</strong><span> / {priceUnitLabel(property)}</span></>}
              <small>
                {depositLabel(property)}
              </small>
            </div>
            <div className="modal-actions">
              <Button variant={saved ? "selected" : "outline"} onClick={onSave}>
                <Heart size={16} fill={saved ? "currentColor" : "none"} />{" "}
                {saved ? "Saved" : "Save"}
              </Button>
              <Button
                variant={compared ? "selected" : "outline"}
                onClick={onCompare}
              >
                <Scale size={16} /> {compared ? "Compared" : "Compare"}
              </Button>
              <Button variant="outline" onClick={onMessage}>
                <MessageCircle size={16} /> Contact host
              </Button>
              <Button
                onClick={() => {
                  if (!applied) onApply();
                  setApplied(true);
                }}
              >
                {applied ? (
                  <>
                    <Check size={16} /> Applied
                  </>
                ) : (
                  "Apply now"
                )}
              </Button>
              <Button
                variant="navy"
                onClick={onSchedule}
                disabled={viewingRequested}
              >
                {viewingRequested ? (
                  <>
                    <Check size={16} /> Viewing requested
                  </>
                ) : (
                  <>
                    <CalendarDays size={16} /> Schedule viewing
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ViewingCalendar({ property, viewings, onClose, onConfirm }) {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [renterMessage, setRenterMessage] = useState("");
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const bookedDates = new Set(
    viewings
      .filter((viewing) => viewing.propertyId === property.id && /^\d{4}-\d{2}-\d{2}$/.test(viewing.date))
      .map((viewing) => viewing.date),
  );
  const calendarDays = [
    ...Array(monthStart.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dateKey = [
        month.getFullYear(),
        String(month.getMonth() + 1).padStart(2, "0"),
        String(day).padStart(2, "0"),
      ].join("-");
      return { day, dateKey, unavailable: dateKey < todayKey || bookedDates.has(dateKey) };
    }),
  ];
  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(month);
  const selectedLabel = selectedDate
    ? new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(new Date(`${selectedDate}T00:00:00`))
    : "";
  const goToPreviousMonth = () => {
    setSelectedDate("");
    setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
    setSelectedDate("");
    setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  };

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop calendar-backdrop" onClick={onClose}>
      <section
        className="viewing-calendar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewing-calendar-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="viewing-calendar-header">
          <div>
            <p className="eyebrow">CHOOSE A DATE</p>
            <h2 id="viewing-calendar-title">Schedule a viewing</h2>
            <p>{property.name}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close calendar">
            <X size={19} />
          </button>
        </header>
        <div className="calendar-month-heading">
          <button
            className="icon-button"
            type="button"
            onClick={goToPreviousMonth}
            disabled={monthStart.getTime() <= new Date(today.getFullYear(), today.getMonth(), 1).getTime()}
            aria-label="Previous month"
          >
            <ArrowLeft size={17} />
          </button>
          <h3 aria-live="polite">{monthLabel}</h3>
          <button className="icon-button" type="button" onClick={goToNextMonth} aria-label="Next month">
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="viewing-calendar-grid" role="grid" aria-label={monthLabel}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span className="calendar-weekday" role="columnheader" key={day}>{day}</span>
          ))}
          {calendarDays.map((calendarDay, index) => calendarDay ? (
            <button
              className={`calendar-day ${calendarDay.unavailable ? "unavailable" : ""} ${selectedDate === calendarDay.dateKey ? "selected" : ""}`}
              type="button"
              role="gridcell"
              key={calendarDay.dateKey}
              disabled={calendarDay.unavailable}
              aria-label={`${new Intl.DateTimeFormat("en", { dateStyle: "full" }).format(new Date(`${calendarDay.dateKey}T00:00:00`))}, ${calendarDay.unavailable ? "not available" : "available"}`}
              aria-pressed={selectedDate === calendarDay.dateKey}
              onClick={() => setSelectedDate(calendarDay.dateKey)}
            >
              {calendarDay.day}
            </button>
          ) : <span className="calendar-day-empty" role="gridcell" key={`empty-${index}`} />)}
        </div>
        <div className="calendar-legend" aria-label="Date availability">
          <span><i /> Available</span>
          <span><i className="unavailable-marker" /> Not available</span>
        </div>
        <div className="viewing-calendar-footer">
          <div className="viewing-request-fields">
            <p>{selectedDate ? `Selected: ${selectedLabel}` : "Choose an available date to continue."}</p>
            <label>Preferred time<input type="time" value={requestedTime} onChange={(event) => setRequestedTime(event.target.value)} required /></label>
            <label>Message to host<textarea value={renterMessage} onChange={(event) => setRenterMessage(event.target.value)} rows={2} placeholder="Share your preferred time or any details for the host." required /></label>
            <div className="viewing-calendar-buttons">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="button" disabled={!selectedDate || !requestedTime || !renterMessage.trim()} onClick={() => onConfirm(selectedDate, requestedTime, renterMessage.trim())}>
                <CalendarDays size={15} /> Send request
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HostDashboard({ properties, applicants, maintenanceRequests, onNavigate, onNewListing }) {
  return (
    <div className="workspace-content">
      <section className="dashboard-welcome host-welcome">
        <div>
          <p className="eyebrow">YOUR PROPERTY WORKSPACE</p>
          <h1>Your rentals, at a glance.</h1>
          <p>Keep listings fresh and make every inquiry count.</p>
        </div>
        <Button onClick={onNewListing}>
          <Plus size={16} /> Add a property
        </Button>
      </section>
      <div className="stat-grid host-stat-grid">
        <StatCard
          icon={Building2}
          label="Total properties"
          value={properties.length}
          note="Posted by you"
          tone="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Available slots"
          value={properties.reduce((total, property) => total + (Number.isInteger(property.units) ? property.units : 0), 0)}
          note="Across your properties"
          tone="green"
        />
        <StatCard
          icon={MessageCircle}
          label="Applications"
          value={applicants.length}
          note="Needs your attention"
          tone="amber"
        />
        <StatCard
          icon={Wrench}
          label="Maintenance"
          value={maintenanceRequests.length}
          note="Renter requests"
          tone="rose"
        />
      </div>
      <div className="host-dashboard-grid">
        <section className="surface-panel">
          <div className="surface-panel-heading">
            <div>
              <h2>Recent inquiries</h2>
              <p>New renter interest in your listings.</p>
            </div>
            <button
              className="text-link"
              onClick={() => onNavigate("applicants")}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          <ApplicantRows applicants={applicants.slice(0, 3)} compact />
        </section>
      </div>
      <section className="dashboard-section">
        <div className="subsection-heading">
          <div>
            <p className="eyebrow">YOUR LISTINGS</p>
            <h2>Keep your homes moving</h2>
          </div>
          <button className="text-link" onClick={() => onNavigate("listings")}>
            Manage properties <ArrowRight size={15} />
          </button>
        </div>
        <div className="host-listing-preview">
            {properties.length ? properties.slice(0, 2).map((property) => (
            <article className="host-listing-row" key={property.id}>
              <img src={property.image || fallbackImage} alt="" />
              <span>
                <strong>{property.name}</strong>
                <small>
                  {property.location} · {currency.format(property.price)} / {priceUnitLabel(property)}
                </small>
              </span>
              <span className="status-pill status-active">Active</span>
              <span className="host-views">{Number.isInteger(property.units) ? `${property.units} slots available` : "Availability not listed"}</span>
            </article>
          )) : <div className="panel-empty">You haven't posted any properties yet. Add a property to see it here.</div>}
        </div>
      </section>
    </div>
  );
}

function ApplicantRows({ applicants, onDecision, onMessage, compact = false }) {
  if (!applicants.length) return <div className="panel-empty">No applications here yet. New renter interest will appear in this list.</div>;
  return <div className={`applicant-list ${compact ? "compact" : ""}`}>{applicants.map((applicant) => <article className="applicant-row" key={applicant.id}><span className="applicant-avatar">{applicant.name.charAt(0)}</span><span className="applicant-person"><strong>{applicant.name}</strong><small>{applicant.property} · {applicant.date}</small></span><span className={`status-pill status-${applicant.status.toLowerCase()}`}>{applicant.status}</span><span className="applicant-actions">{applicant.status === "Pending" && <><button className="icon-button approve-action" onClick={() => onDecision(applicant.id, "Approved")} aria-label={`Approve ${applicant.name}`} title="Approve"><Check size={17} /></button><button className="icon-button reject-action" onClick={() => onDecision(applicant.id, "Declined")} aria-label={`Decline ${applicant.name}`} title="Decline"><X size={17} /></button></>}<button className="icon-button" onClick={() => onMessage(applicant.name)} aria-label={`Message ${applicant.name}`} title="Message"><MessageCircle size={16} /></button></span></article>)}</div>;
}

function HostListings({ properties, onNewListing, onEdit, onOpenSlot, onRemove, onToast }) {
  const remove = async (property) => {
    if (!window.confirm(`Permanently remove "${property.name}" from your listings?`)) return;
    await onRemove(property);
  };

  return <div className="workspace-content">
    <SectionHeading eyebrow="PROPERTY MANAGEMENT" title="Your properties" detail="Create and manage the homes renters can discover." action={<Button onClick={onNewListing}><Plus size={16} /> Add a property</Button>} />
    {properties.length ? <div className="host-properties">{properties.map((property) => <article className="host-property-card" key={property.id}>
      <img src={property.image || fallbackImage} alt={`${property.name}`} />
      <div className="host-property-info">
        <span className={`status-pill ${property.isDraft || property.units <= 0 ? "status-in-review" : "status-active"}`}>{property.isDraft ? "Draft" : property.units > 0 ? "Accepting renters" : "Fully occupied"}</span>
        <h2>{property.name}</h2>
        <p><MapPin size={14} /> {property.location}, Batangas City</p>
        <div><span>{currency.format(property.price)} / mo</span><span>{property.units} of {property.totalUnits ?? property.units} slots available</span></div>
        {property.units < (property.totalUnits ?? property.units) && <Button variant="outline" size="small" onClick={() => onOpenSlot(property)}><Plus size={14} /> Open a slot</Button>}
        {property.moderationCommentSentAt && property.moderationComments && <aside className="host-moderation-feedback"><span><ShieldCheck size={14} /> Reviewer feedback</span><p>{property.moderationComments}</p><small>Sent {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(property.moderationCommentSentAt))}</small></aside>}
      </div>
      <div className="host-property-actions">
        <Button variant="outline" size="small" onClick={() => onEdit(property)}>Edit listing</Button>
        <Button variant="ghost" size="small" onClick={() => onToast(`${property.name} is ${property.units > 0 && !property.isDraft ? "visible" : "hidden"} to renters.`)}><Eye size={15} /> Preview</Button>
        <Button variant="outline" size="small" className="remove-listing-button" onClick={() => remove(property)}><Trash2 size={14} /> Remove listing</Button>
      </div>
    </article>)}</div> : <EmptyState icon={Building2} title="Your first listing starts here" detail="Add a rental to introduce your property to local renters." action="Add a property" onAction={onNewListing} />}
  </div>;
}

function PropertyEditor({ property, onClose, onSave, onToast }) {
  const [imagePreviews, setImagePreviews] = useState(() => [...new Set([...(property?.images || []), property?.image].filter(Boolean))]);
  const [amenities, setAmenities] = useState(property?.amenities || []);
  const [error, setError] = useState("");
  const toggle = (amenity) => setAmenities(amenities.includes(amenity) ? amenities.filter((item) => item !== amenity) : [...amenities, amenity]);
  const upload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (files.some((file) => !file.type.startsWith("image/"))) {
      setError("Choose image files only.");
      return;
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setError("Each photo must be 5 MB or smaller.");
      return;
    }
    const existingDataBytes = imagePreviews.reduce(
      (total, image) => total + (image.startsWith("data:") ? image.length * 0.75 : 0),
      0,
    );
    if (imagePreviews.length + files.length > 10) {
      setError("A listing can have up to 10 photos.");
      return;
    }
    if (existingDataBytes + files.reduce((total, file) => total + file.size, 0) > 18 * 1024 * 1024) {
      setError("The total photo size for a listing must be 18 MB or smaller.");
      return;
    }
    try {
      const photos = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("The selected photo could not be read."));
        reader.onerror = () => reject(reader.error || new Error("The selected photo could not be read."));
        reader.readAsDataURL(file);
      })));
      setImagePreviews((current) => [...new Set([...current, ...photos])]);
      setError("");
    } catch (uploadError) {
      setError(`Could not read the selected photos: ${uploadError.message}`);
    }
  };
  const submit = async (event, publish) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const title = values.get("name")?.toString().trim();
    const rent = Number(values.get("price"));
    const latitudeText = values.get("latitude")?.toString().trim() || "";
    const longitudeText = values.get("longitude")?.toString().trim() || "";
    const latitude = latitudeText ? Number(latitudeText) : null;
    const longitude = longitudeText ? Number(longitudeText) : null;
    const hasValidPin = Number.isFinite(latitude)
      && Number.isFinite(longitude)
      && latitude >= -90
      && latitude <= 90
      && longitude >= -180
      && longitude <= 180;
    const requiresMapPin = ["Apartment", "Bedspace", "Boarding House", "Dormitory", "Studio Unit"]
      .includes(values.get("type")?.toString() || "");
    if (!title || !rent || !values.get("address")) { setError("Add a property name, address, and monthly rent to continue."); return; }
    if ((latitudeText || longitudeText) && !hasValidPin) { setError("Enter valid latitude and longitude coordinates."); return; }
    if (publish && requiresMapPin && !hasValidPin && !property?.sourceListingId) { setError("Add the exact map pin coordinates before publishing this rental."); return; }
    try {
      const availableSlots = Number(values.get("units"));
      const depositText = values.get("deposit")?.toString().trim() || "";
      const toLines = (name) => values.get(name)?.toString().split(/\r?\n/).map((line) => line.trim()).filter(Boolean) || [];
      await onSave({
        ...property,
        id: property?.id || `rental-${Date.now()}`,
        name: title,
        location: values.get("location"),
        address: values.get("address"),
        latitude: hasValidPin ? latitude : null,
        longitude: hasValidPin ? longitude : null,
        mapUrl: property?.mapUrl || "",
        type: values.get("type"),
        price: rent,
        priceBasis: values.get("priceBasis") || null,
        deposit: depositText ? Number(depositText) : property?.deposit ?? null,
        bedrooms: Number(values.get("bedrooms")),
        bathrooms: Number(values.get("bathrooms")),
        units: availableSlots,
        totalUnits: Math.max(property?.totalUnits || 0, availableSlots),
        rating: property?.rating || 0,
        reviews: property?.reviews || 0,
        image: imagePreviews[0] || fallbackImage,
        images: imagePreviews,
        label: publish ? "NEW LISTING" : "DRAFT",
        host: values.get("host"),
        hostEmail: values.get("hostEmail"),
        hostPhone: values.get("hostPhone"),
        hostSince: property?.hostSince || "New RentMatch host",
        description: values.get("description"),
        amenities,
        amenityDetails: property?.amenityDetails || amenities,
        capacity: values.get("capacity")?.toString().trim() || "",
        includedUtilities: toLines("includedUtilities"),
        additionalCosts: toLines("additionalCosts"),
        houseRules: toLines("houseRules"),
        occupancyRestriction: values.get("occupancyRestriction")?.toString().trim() || "",
        distance: values.get("distance")?.toString().trim() || "",
        available: publish && availableSlots > 0,
        isDraft: !publish,
        moderationStatus: property?.moderationStatus || (publish ? "Needs review" : "Draft"),
        createdAt: property?.createdAt || new Date().toISOString(),
      });
    } catch (saveError) {
      setError(`Could not save this listing: ${saveError.message}`);
      return;
    }
    onClose();
    onToast(publish ? "Your listing has been published." : "Draft saved.");
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title" onClick={(event) => event.stopPropagation()}>
        <header className="editor-header">
          <div>
            <p className="eyebrow">PROPERTY MANAGEMENT</p>
            <h2 id="editor-title">{property ? "Edit property" : "Add a property"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close form"><X size={19} /></button>
        </header>
        <form onSubmit={(event) => submit(event, true)}>
          <div className="editor-grid">
            <Field label="Property name"><input name="name" defaultValue={property?.name} placeholder="e.g. Kumintang Garden Studio" required /></Field>
            <Field label="Property type">
              <select name="type" defaultValue={property?.type || "Apartment"}>
                {propertyTypes.slice(1).map((type) => <option key={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Address"><input name="address" defaultValue={property?.address} placeholder="Street, neighborhood, Batangas City" required /></Field>
            <Field label="Neighborhood">
              <select name="location" defaultValue={property?.location || "Poblacion"}>
                {locations.slice(1).map((location) => <option key={location}>{location}</option>)}
              </select>
            </Field>
            <Field label="Map latitude"><input name="latitude" type="number" min="-90" max="90" step="any" defaultValue={property?.latitude ?? ""} placeholder="e.g. 13.7860482" /></Field>
            <Field label="Map longitude"><input name="longitude" type="number" min="-180" max="180" step="any" defaultValue={property?.longitude ?? ""} placeholder="e.g. 121.0761466" /></Field>
            <p className="editor-wide map-pin-help">For an exact pin, open the location in Google Maps, right-click the property, and copy its coordinates here. New apartment, dormitory, bedspace, and boarding-house listings need a pin before publishing.</p>
            <Field label="Rent price (₱)"><input name="price" type="number" min="1" step="any" defaultValue={property?.price} required /></Field>
            <Field label="Price basis">
              <select name="priceBasis" defaultValue={property?.priceBasis || ""}>
                <option value="">Per unit / month</option>
                <option value="per-person-month">Per person / month</option>
                <option value="per-person">Per person; period not stated</option>
                <option value="unspecified">Rental period not stated</option>
              </select>
            </Field>
            <Field label="Security deposit (₱)"><input name="deposit" type="number" min="0" step="any" defaultValue={property?.deposit} /></Field>
            <Field label="Bedrooms"><input name="bedrooms" type="number" min="0" defaultValue={property?.bedrooms || 1} /></Field>
            <Field label="Bathrooms"><input name="bathrooms" type="number" min="1" defaultValue={property?.bathrooms || 1} /></Field>
            <Field label="Available units"><input name="units" type="number" min="1" defaultValue={property?.units || 1} /></Field>
            <Field label="Capacity / room setup"><input name="capacity" defaultValue={property?.capacity} placeholder="e.g. 4 people per room" /></Field>
            <Field label="Host contact name"><input name="host" defaultValue={property?.host} placeholder="Name shown to renters" /></Field>
            <Field label="Host contact email"><input name="hostEmail" type="email" defaultValue={property?.hostEmail} placeholder="host@example.com" /></Field>
            <Field label="Host contact phone"><input name="hostPhone" type="tel" defaultValue={property?.hostPhone} placeholder="+63 9XX XXX XXXX" /></Field>
            <Field label="Description" className="editor-wide"><textarea name="description" defaultValue={property?.description} rows="3" placeholder="Tell renters what makes this place feel like home." /></Field>
            <Field label="Nearby places & accessibility" className="editor-wide"><textarea name="distance" defaultValue={property?.distance} rows="2" placeholder="Nearby schools, shops, and transport." /></Field>
            <Field label="Included utilities (one per line)" className="editor-wide"><textarea name="includedUtilities" defaultValue={property?.includedUtilities?.join("\n")} rows="2" placeholder="Water&#10;Wi-Fi" /></Field>
            <Field label="Additional costs (one per line)" className="editor-wide"><textarea name="additionalCosts" defaultValue={property?.additionalCosts?.join("\n")} rows="2" placeholder="Electricity is billed separately." /></Field>
            <Field label="House rules (one per line)" className="editor-wide"><textarea name="houseRules" defaultValue={property?.houseRules?.join("\n")} rows="2" placeholder="Female tenants only" /></Field>
            <Field label="Occupancy restrictions" className="editor-wide"><input name="occupancyRestriction" defaultValue={property?.occupancyRestriction} placeholder="e.g. Female students only" /></Field>
            <div className="amenity-filter editor-wide">
              <span className="filter-label">Amenities</span>
              <div className="choice-grid">
                {amenityOptions.map((amenity) => <label key={amenity} className={`choice-chip ${amenities.includes(amenity) ? "selected" : ""}`}><input type="checkbox" checked={amenities.includes(amenity)} onChange={() => toggle(amenity)} />{amenity}</label>)}
              </div>
            </div>
            <label className="upload-preview editor-wide">
              <Upload size={18} />
              <span>{imagePreviews.length ? "Add more property photos" : "Upload property photos"}<small>{imagePreviews.length} of 10 photos selected; each photo must be 5 MB or smaller.</small></span>
              <input type="file" accept="image/*" multiple onChange={upload} />
            </label>
            <div className="photo-preview-grid editor-wide">
              {imagePreviews.map((image, index) => (
                <div className="photo-preview" key={`${image.slice(0, 40)}-${index}`}>
                  <img src={image} alt={`Property photo ${index + 1}`} />
                  <button type="button" className="icon-button" onClick={() => setImagePreviews((current) => current.filter((_, photoIndex) => photoIndex !== index))} aria-label={`Remove property photo ${index + 1}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="form-alert" role="alert">{error}</p>}
          <div className="editor-actions">
            <Button type="button" variant="outline" onClick={(event) => submit({ preventDefault: () => {}, currentTarget: event.currentTarget.form }, false)}>Save draft</Button>
            <Button type="submit"><Check size={15} /> Publish listing</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AnalyticsPage({ properties, applicants }) {
  return <div className="workspace-content"><SectionHeading eyebrow="INSIGHTS THAT MOVE YOU FORWARD" title="Performance analytics" detail="A snapshot of listing interest and renter matches." action={<span className="listing-counter"><span className="live-dot" /> Last 30 days</span>} /><div className="stat-grid analytics-stat-grid"><StatCard icon={Eye} label="Property views" value="4,829" note="↑ 14.2% vs. last month" tone="blue" /><StatCard icon={CalendarDays} label="Viewing requests" value="38" note="↑ 8.4% vs. last month" tone="amber" /><StatCard icon={CheckCircle2} label="Occupancy rate" value="82%" note="Across active listings" tone="green" /><StatCard icon={Sparkles} label="Match performance" value="91%" note="Average renter fit" tone="rose" /></div><div className="analytics-grid"><section className="surface-panel analytics-chart-panel"><div className="surface-panel-heading"><div><h2>Views & inquiry activity</h2><p>Listing engagement over the last 7 days.</p></div><span className="chart-legend"><i /> Views <i className="legend-secondary" /> Inquiries</span></div><div className="large-chart"><div className="chart-scale"><span>500</span><span>400</span><span>300</span><span>200</span><span>100</span></div><div className="chart-columns">{[[62, 28], [75, 35], [55, 24], [84, 48], [67, 40], [92, 54], [78, 42]].map(([views, inquiries], index) => <div className="chart-column" key={index}><span className="chart-bar" style={{ height: `${views}%` }} /><span className="chart-bar secondary" style={{ height: `${inquiries}%` }} /></div>)}</div></div><div className="chart-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></section><section className="surface-panel most-viewed"><div className="surface-panel-heading"><div><h2>Most viewed homes</h2><p>Properties renters are exploring.</p></div></div>{properties.slice(0, 4).map((property, index) => <div className="viewed-row" key={property.id}><span className="viewed-rank">0{index + 1}</span><img src={property.image || fallbackImage} alt="" /><span><strong>{property.name}</strong><small>{property.location}</small></span><span className="viewed-count">{Math.max(98, 342 - index * 61)}<small> views</small></span></div>)}</section></div><section className="insight-banner"><TrendingUp size={19} /><span><strong>Your listings are getting noticed.</strong> Responding to an inquiry within 24 hours can help keep renters engaged.</span></section></div>;
}

function AdminPropertyReview({ property, accounts, onClose, onApprove, onRemove, onSaveComments, onSendComments }) {
  const [comments, setComments] = useState(property.moderationComments || "");
  const [savingComments, setSavingComments] = useState(false);
  const [sendingComments, setSendingComments] = useState(false);
  const photos = [...new Set([...(property.images || []), property.image].filter(Boolean))];
  const ownerName = property.host && property.host !== "Property owner" ? property.host : "";
  const ownerAccount = accounts.find((account) => account.name === ownerName);
  const accuracyItems = [
    ["Property name", property.name],
    ["Property type", property.type],
    ["Address", property.address],
    ["Rent amount", Number.isFinite(Number(property.price)) && Number(property.price) > 0 ? `${currency.format(property.price)} / ${priceUnitLabel(property)}` : ""],
    ["Listing description", property.description],
    ["Amenities", property.amenities?.length ? property.amenities.join(", ") : ""],
    ["Room and amenity details", property.amenityDetails?.join(", ") || ""],
    ["Capacity / room setup", property.capacity || ""],
    ["Included utilities", property.includedUtilities?.join(", ") || ""],
    ["Additional costs", property.additionalCosts?.join(" ") || ""],
    ["House rules", property.houseRules?.join("; ") || property.occupancyRestriction || ""],
    ["Nearby places & accessibility", property.distance || ""],
  ];
  const suppliedCount = accuracyItems.filter(([, value]) => Boolean(value)).length;
  const saveComments = async () => {
    setSavingComments(true);
    try {
      await onSaveComments(property, comments.trim());
    } finally {
      setSavingComments(false);
    }
  };
  const sendComments = async () => {
    setSendingComments(true);
    try {
      if (await onSendComments(property, comments.trim())) {
        setComments(comments.trim());
      }
    } finally {
      setSendingComments(false);
    }
  };

  return (
    <div className="modal-backdrop admin-review-backdrop" onClick={onClose}>
      <section
        className="admin-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-review-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-review-modal-header">
          <div>
            <p className="eyebrow">PROPERTY MODERATION</p>
            <h2 id="admin-review-title">Review listing</h2>
            <p>Check the owner details and listing information before making a decision.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close review"><X size={19} /></button>
        </header>
        <div className="admin-review-modal-content">
          <div className="admin-review-modal-title">
            <div>
              <span className={`status-pill ${property.moderationStatus === "Approved" ? "status-active" : "status-in-review"}`}>
                {property.moderationStatus || "Needs review"}
              </span>
              <h3>{property.name}</h3>
              <p>{property.type} · {currency.format(property.price)} {priceUnitLabel(property)}</p>
            </div>
          </div>

          <section className="review-detail-section">
            <div className="review-section-heading"><Building2 size={17} /><h3>Owner Identity</h3></div>
            <div className="review-detail-grid">
              <div><span>Owner / host</span><strong>{ownerName || "Not provided"}</strong></div>
              <div><span>Account verification</span><strong>{ownerAccount ? ownerAccount.status : "Identity evidence not provided"}</strong></div>
              <div><span>Hosting history</span><strong>{property.hostSince || "Not provided"}</strong></div>
            </div>
          </section>

          <section className="review-detail-section">
            <div className="review-section-heading"><MapPin size={17} /><h3>Property Address</h3></div>
            <p className="review-address">{property.address || "Address not provided"}{property.location ? ` · ${property.location}, Batangas City` : ""}</p>
          </section>

          <section className="review-detail-section">
            <div className="review-section-heading"><Eye size={17} /><h3>Property Photos</h3><span>{photos.length} photo{photos.length === 1 ? "" : "s"}</span></div>
            {photos.length ? (
              <div className="review-photo-grid">{photos.map((photo, index) => <img key={`${photo}-${index}`} src={photo} alt={`${property.name} photo ${index + 1}`} />)}</div>
            ) : <p className="review-missing">No property photos provided.</p>}
          </section>

          <section className="review-detail-section">
            <div className="review-section-heading"><Phone size={17} /><h3>Contact Information</h3></div>
            <div className="review-detail-grid">
              <div><span>Contact name</span><strong>{ownerName || "Not provided"}</strong></div>
              <div><span>Email</span><strong>{property.hostEmail || "Not provided"}</strong></div>
              <div><span>Phone</span><strong>{property.hostPhone || "Not provided"}</strong></div>
            </div>
          </section>

          <section className="review-detail-section">
            <div className="review-section-heading"><CheckCircle2 size={17} /><h3>Listing Accuracy</h3><span>{suppliedCount}/{accuracyItems.length} details provided</span></div>
            <p className="review-accuracy-note">Compare these submitted details with the owner’s evidence; provided information has not been independently verified.</p>
            <div className="review-accuracy-grid">
              {accuracyItems.map(([label, value]) => (
                <div className={`review-accuracy-item ${value ? "is-provided" : "is-missing"}`} key={label}>
                  {value ? <CheckCircle2 size={15} /> : <CircleHelp size={15} />}
                  <span><strong>{label}</strong><small>{value || "Not provided"}</small></span>
                </div>
              ))}
              <div className={`review-accuracy-item ${Number.isInteger(property.bedrooms) && Number.isInteger(property.bathrooms) ? "is-provided" : "is-missing"}`}>
                {Number.isInteger(property.bedrooms) && Number.isInteger(property.bathrooms) ? <CheckCircle2 size={15} /> : <CircleHelp size={15} />}
                <span><strong>Rooms</strong><small>{Number.isInteger(property.bedrooms) && Number.isInteger(property.bathrooms) ? `${property.bedrooms} bedroom${property.bedrooms === 1 ? "" : "s"}, ${property.bathrooms} bathroom${property.bathrooms === 1 ? "" : "s"}` : "Room details not provided"}</small></span>
              </div>
            </div>
            {property.description && <p className="review-description">{property.description}</p>}
          </section>

          <section className="review-detail-section review-comments-section">
            <div className="review-section-heading"><MessageCircle size={17} /><h3>Reviewer Comments</h3></div>
            <p className="review-accuracy-note">Describe what is incorrect or missing so the submitter knows what to fix.</p>
            <label className="review-comments-label" htmlFor="moderation-comments">What needs to be corrected?</label>
            <textarea
              id="moderation-comments"
              className="review-comments-input"
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="For example: Please provide a clearer property address or confirm the rent amount."
            />
            <div className="review-comments-actions">
              <span>{comments.length}/2000 characters</span>
              <div className="review-comments-buttons">
                <Button variant="outline" size="small" onClick={saveComments} disabled={savingComments || sendingComments}>
                  <Check size={14} /> {savingComments ? "Saving..." : "Save comment"}
                </Button>
                <Button size="small" onClick={sendComments} disabled={!comments.trim() || savingComments || sendingComments}>
                  <Send size={14} /> {sendingComments ? "Sending..." : property.moderationCommentSentAt ? "Send again" : "Send to host"}
                </Button>
              </div>
            </div>
            {property.moderationCommentSentAt && <p className="review-comment-sent"><CheckCircle2 size={14} /> Sent to the host on {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(property.moderationCommentSentAt))}.</p>}
          </section>
        </div>
        <footer className="admin-review-modal-footer">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {property.moderationStatus === "Approved"
            ? <Button variant="outline" onClick={() => onApprove(property, "Needs review")}>Reopen review</Button>
            : <Button onClick={() => onApprove(property, "Approved")}><Check size={14} /> Approve listing</Button>}
          <Button variant="ghost" onClick={() => onRemove(property)}><X size={14} /> Remove listing</Button>
        </footer>
      </section>
    </div>
  );
}

function AdminPage({ properties, setProperties, onToast }) {
  const [accounts, setAccounts] = useState([
    { name: "Maya Santos", role: "Property host", status: "Verified", email: "maya.santos@example.com" },
    { name: "Rafael Cruz", role: "Property host", status: "In review", email: "rafael.c@example.com" },
    { name: "Gabriela Ramos", role: "Renter", status: "Active", email: "gabriela.r@example.com" },
    { name: "Maya Santos", role: "Property host", status: "Verified", email: "landlord@rentmatch.local" },
  ]);
  const [activeTool, setActiveTool] = useState("");
  const [reviewProperty, setReviewProperty] = useState(null);
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const reloadProperties = async () => {
    if (staticPreview) {
      onToast("Admin refresh requires the full RentMatch app.");
      return;
    }
    setRefreshing(true);
    try {
      const serverProperties = await apiRequest("/api/properties");
      if (serverProperties && Array.isArray(serverProperties)) {
        setProperties(serverProperties);
      }
      const serverAccounts = await apiRequest("/api/accounts");
      if (serverAccounts && Array.isArray(serverAccounts) && serverAccounts.length > 0) {
        setAccounts(serverAccounts);
      }
      onToast("Admin data refreshed.");
    } catch (error) {
      onToast(`Could not refresh: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (staticPreview) return;
    let cancelled = false;
    const loadAdminData = async () => {
      try {
        let serverAccounts = await apiRequest("/api/accounts");
        if (!serverAccounts || serverAccounts.length === 0) {
          serverAccounts = await apiRequest("/api/accounts/seed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(accounts),
          });
        }
        if (!cancelled && serverAccounts?.length) setAccounts(serverAccounts);
      } catch (error) {
        console.error("Could not load admin accounts from the backend.", error);
      }
      try {
        const serverProperties = await apiRequest("/api/properties");
        if (!cancelled && serverProperties?.length) setProperties(serverProperties);
      } catch (error) {
        console.error("Could not load admin properties from the backend.", error);
      }
    };
    loadAdminData();
    return () => { cancelled = true; };
  }, []);
  const verify = async (account) => {
    if (staticPreview) {
      onToast("Verification updates require the full RentMatch app.");
      return;
    }
    try {
      const updatedAccount = await apiRequest(`/api/accounts/${encodeURIComponent(account.email)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: account.email, status: "Verified" }),
      });
      setAccounts((current) => current.map((item) => item.email === updatedAccount.email ? updatedAccount : item));
      onToast(`${account.name} is marked verified and saved.`);
    } catch (error) {
      onToast(`Could not save verification: ${error.message}`);
    }
  };
  const setModerationStatus = async (property, status) => {
    if (staticPreview) {
      onToast("Listing review updates require the full RentMatch app.");
      return false;
    }
    try {
      const updated = await apiRequest(`/api/properties/${encodeURIComponent(property.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...property, moderationStatus: status }),
      });
      setProperties((current) => current.map((item) => item.id === updated.id ? updated : item));
      onToast(`${property.name} marked ${status.toLowerCase()}.`);
      return true;
    } catch (error) {
      onToast(`Could not update the listing: ${error.message}`);
      return false;
    }
  };
  const removeListing = async (property) => {
    if (staticPreview) {
      onToast("Removing listings requires the full RentMatch app.");
      return false;
    }
    try {
      await apiRequest(`/api/properties/${encodeURIComponent(property.id)}`, { method: "DELETE" });
      setProperties((current) => current.filter((item) => item.id !== property.id));
      onToast(`${property.name} was removed.`);
      return true;
    } catch (error) {
      onToast(`Could not remove the listing: ${error.message}`);
      return false;
    }
  };
  const setListingAvailability = async (property) => {
    try {
      const updated = await apiRequest(`/api/properties/${encodeURIComponent(property.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...property, available: !property.available, isDraft: false }),
      });
      setProperties((current) => current.map((item) => item.id === updated.id ? updated : item));
      onToast(`${property.name} ${updated.available ? "published" : "paused"}.`);
    } catch (error) {
      onToast(`Could not update the listing: ${error.message}`);
    }
  };
  const saveModerationComments = async (property, comments) => {
    try {
      const updated = await apiRequest(`/api/properties/${encodeURIComponent(property.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...property, moderationComments: comments, moderationCommentSentAt: property.moderationCommentSentAt || null }),
      });
      setProperties((current) => current.map((item) => item.id === updated.id ? updated : item));
      onToast("Reviewer comments saved.");
      return true;
    } catch (error) {
      onToast(`Could not save reviewer comments: ${error.message}`);
      return false;
    }
  };
  const sendModerationComments = async (property, comments) => {
    if (!comments.trim()) {
      onToast("Add a comment before sending it to the host.");
      return false;
    }
    try {
      const sentAt = new Date().toISOString();
      const updated = await apiRequest(`/api/properties/${encodeURIComponent(property.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...property,
          moderationComments: comments.trim(),
          moderationCommentSentAt: sentAt,
          moderationCommentSentTo: property.hostEmail || property.host || "Property poster",
        }),
      });
      setProperties((current) => current.map((item) => item.id === updated.id ? updated : item));
      onToast(`Reviewer comment sent to ${property.host || "the property poster"}.`);
      return true;
    } catch (error) {
      onToast(`Could not send reviewer comment: ${error.message}`);
      return false;
    }
  };
  const toolHeader = (eyebrow, title, detail) => (
    <div className="admin-tool-heading">
      <Button variant="outline" size="small" onClick={() => setActiveTool("")}><ArrowLeft size={15} /> Admin overview</Button>
      <SectionHeading eyebrow={eyebrow} title={title} detail={detail} />
    </div>
  );
  let toolContent = null;
  if (activeTool === "moderation") {
    const pending = properties.filter((property) => property.moderationStatus !== "Approved");
    toolContent = <>{toolHeader("LISTING REVIEW", "Property moderation", "Select a property to review its owner identity, photos, contact details, and listing accuracy.")}<section className="admin-review-list">{properties.length ? properties.map((property) => <article className="admin-review-card" key={property.id}><button className="admin-review-open" type="button" onClick={() => setReviewProperty(property)} aria-label={`Review ${property.name}`}><img src={property.image || fallbackImage} alt="" /><span className="admin-review-info"><span className={`status-pill ${property.moderationStatus === "Approved" ? "status-active" : "status-in-review"}`}>{property.moderationStatus || "Needs review"}</span><strong>{property.name}</strong><span>{property.address}</span><small>{property.type} · {currency.format(property.price)} · Host: {property.host || "Not provided"}</small></span><span className="admin-review-open-link">Review details <ChevronRight size={15} /></span></button><div className="admin-review-actions">{property.moderationStatus === "Approved" ? <Button variant="outline" size="small" onClick={() => setModerationStatus(property, "Needs review")}>Reopen review</Button> : <Button size="small" onClick={() => setModerationStatus(property, "Approved")}><Check size={14} /> Approve</Button>}<Button variant="ghost" size="small" onClick={() => removeListing(property)}><X size={14} /> Remove</Button></div></article>) : <EmptyState icon={Building2} title="No listings to review" detail="New rental listings will appear here." />}</section><p className="admin-tool-footnote">{pending.length} listing{pending.length === 1 ? "" : "s"} need review.</p></>;
  } else if (activeTool === "verification") {
    const pendingAccounts = accounts.filter((account) => account.status === "In review");
    toolContent = <>{toolHeader("TRUST & SAFETY", "Account Verification", "Review host identity checks and update verification status.")}<section className="surface-panel admin-table-panel"><div className="surface-panel-heading"><div><h2>{pendingAccounts.length} account{pendingAccounts.length === 1 ? "" : "s"} awaiting verification</h2><p>Verification decisions are saved to the backend.</p></div><span className="admin-badge"><ShieldCheck size={14} /> VERIFICATION QUEUE</span></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>Member</th><th>Role</th><th>Email</th><th>Status</th><th>Action</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.email}><td><span className="admin-member-avatar">{account.name.charAt(0)}</span>{account.name}</td><td>{account.role}</td><td>{account.email}</td><td><span className={`status-pill status-${account.status.toLowerCase().replaceAll(" ", "-")}`}>{account.status}</span></td><td>{account.status === "In review" ? <Button size="small" onClick={() => verify(account)}><Check size={13} /> Verify</Button> : <span className="admin-table-note">{account.status === "Verified" ? "Verified" : "No verification required"}</span>}</td></tr>)}</tbody></table></div></section></>;
  } else if (activeTool === "listings") {
    toolContent = <>{toolHeader("MARKETPLACE OPERATIONS", "Listing Management", "Manage listing availability and remove listings from the marketplace.")}<section className="admin-review-list">{properties.length ? properties.map((property) => <article className="admin-review-card" key={property.id}><img src={property.image || fallbackImage} alt="" /><div className="admin-review-info"><span className={`status-pill ${property.available ? "status-active" : "status-in-review"}`}>{property.units === 0 ? "Full" : property.available ? "Published" : "Paused"}</span><h2>{property.name}</h2><p>{property.address}</p><small>{property.type} · {currency.format(property.price)}</small><small>Slots available: {Number.isInteger(property.units) ? property.units : "Not listed"}{Number.isInteger(property.totalUnits) ? ` of ${property.totalUnits}` : ""}</small></div><div className="admin-review-actions"><Button variant="outline" size="small" onClick={() => setListingAvailability(property)}>{property.available ? "Pause listing" : "Publish listing"}</Button><Button variant="ghost" size="small" onClick={() => removeListing(property)}><X size={14} /> Remove</Button></div></article>) : <EmptyState icon={Building2} title="No listings" detail="There are no properties in the marketplace." />}</section></>;
  } else if (activeTool === "analytics") {
    toolContent = <>{toolHeader("MARKETPLACE INSIGHTS", "Analytics dashboard", "Review marketplace activity and listing engagement.")}<AnalyticsPage properties={properties} applicants={[]} /></>;
  }
  const pendingModerationCount = properties.filter((property) => property.moderationStatus !== "Approved").length;
  const pendingVerificationCount = accounts.filter((account) => account.status === "In review").length;
  const filteredProperties = properties.filter((property) => {
    if (propertyFilter === "pending") return property.moderationStatus !== "Approved";
    if (propertyFilter === "approved") return property.moderationStatus === "Approved";
    return true;
  });
  const overview = (
    <>
      <SectionHeading
        eyebrow="PLATFORM OPERATIONS"
        title="Admin preview"
        detail="Review account status and property moderation in one place."
        action={<span className="admin-badge"><ShieldCheck size={14} /> ADMIN MODE</span>}
      />
      <div className="stat-grid">
        <StatCard icon={Users} label="User accounts" value={String(accounts.length || 248)} note="Registered members" tone="blue" />
        <StatCard icon={Building2} label="Active listings" value={String(properties.filter((property) => property.available).length)} note="Available properties" tone="green" />
        <StatCard icon={Clock3} label="Needs review" value={String(pendingModerationCount)} note="Properties awaiting moderation" tone="amber" />
        <StatCard icon={Building2} label="Total listings" value={String(properties.length)} note="Marketplace properties" tone="rose" />
      </div>
      <section className="surface-panel admin-table-panel">
        <div className="surface-panel-heading">
          <div>
            <h2>User management</h2>
            <p>Review host verification and account status.</p>
          </div>
          <Button variant="outline" size="small" onClick={() => onToast("Admin data is sample content for this browser preview.")}>
            <SlidersHorizontal size={14} /> Filters
          </Button>
        </div>
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr><th>Member</th><th>Role</th><th>Email</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.email}>
                  <td><span className="admin-member-avatar">{account.name.charAt(0)}</span>{account.name}</td>
                  <td>{account.role}</td>
                  <td>{account.email}</td>
                  <td><span className={`status-pill status-${account.status.toLowerCase().replaceAll(" ", "-")}`}>{account.status}</span></td>
                  <td>
                    {account.status === "In review" ? (
                      <Button variant="outline" size="small" onClick={() => verify(account)}>Verify host</Button>
                    ) : (
                      <button className="text-link" onClick={() => onToast(`${account.name} account details opened in preview.`)}>Review</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-panel admin-table-panel">
        <div className="surface-panel-heading">
          <div>
            <h2>Property submissions & moderation</h2>
            <p>Review newly added properties and update marketplace approval status.</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className={`button ${propertyFilter === "all" ? "button-primary" : "button-outline"} button-small`}
              onClick={() => setPropertyFilter("all")}
            >
              All ({properties.length})
            </button>
            <button
              type="button"
              className={`button ${propertyFilter === "pending" ? "button-primary" : "button-outline"} button-small`}
              onClick={() => setPropertyFilter("pending")}
            >
              Needs review ({pendingModerationCount})
            </button>
            <button
              type="button"
              className={`button ${propertyFilter === "approved" ? "button-primary" : "button-outline"} button-small`}
              onClick={() => setPropertyFilter("approved")}
            >
              Approved ({properties.length - pendingModerationCount})
            </button>
            <Button variant="outline" size="small" onClick={reloadProperties} disabled={refreshing}>
              <RotateCcw size={13} /> {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Host / Landlord</th>
                <th>Type & Rent</th>
                <th>Location</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredProperties.length ? (
                filteredProperties.map((property) => {
                  const isApproved = property.moderationStatus === "Approved";
                  const hostName = property.host || property.ownerEmail?.split("@")[0] || "Property host";
                  return (
                    <tr key={property.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <img
                            src={property.image || fallbackImage}
                            alt=""
                            style={{ width: "42px", height: "34px", borderRadius: "4px", objectFit: "cover", flex: "0 0 auto" }}
                          />
                          <div>
                            <strong>{property.name}</strong>
                            <div style={{ color: "#74839a", fontSize: "8px" }}>{property.address}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div><strong>{hostName}</strong></div>
                        <div style={{ color: "#74839a", fontSize: "8px" }}>{property.hostEmail || property.ownerEmail || "Not provided"}</div>
                      </td>
                      <td>
                        <div><strong>{currency.format(property.price)}</strong></div>
                        <div style={{ color: "#74839a", fontSize: "8px" }}>/ {priceUnitLabel(property)} · {property.type}</div>
                      </td>
                      <td>{property.location || "Batangas City"}</td>
                      <td>
                        <span className={`status-pill ${isApproved ? "status-active" : "status-in-review"}`}>
                          {property.moderationStatus || "Needs review"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Button variant="outline" size="small" onClick={() => setReviewProperty(property)}>
                            Review listing
                          </Button>
                          {isApproved ? (
                            <Button variant="ghost" size="small" onClick={() => setModerationStatus(property, "Needs review")}>
                              Reopen
                            </Button>
                          ) : (
                            <Button size="small" onClick={() => setModerationStatus(property, "Approved")}>
                              <Check size={13} /> Approve
                            </Button>
                          )}
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => removeListing(property)}
                            aria-label={`Remove ${property.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#74839a" }}>
                    No properties match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
  const adminTools = [
    { id: "", label: "Overview", icon: LayoutDashboard },
    { id: "moderation", label: "Property moderation", icon: Building2 },
    { id: "verification", label: "Account Verification", icon: ShieldCheck },
    { id: "listings", label: "Listing Management", icon: Building2 },
    { id: "analytics", label: "Analytics dashboard", icon: BarChart3 },
  ];
  return <div className="workspace-content"><div className="admin-console"><aside className="admin-sidebar"><p className="admin-sidebar-heading">ADMIN MENU</p><nav aria-label="Admin tools">{adminTools.map(({ id, label, icon: Icon }) => <button key={id || "overview"} type="button" className={activeTool === id ? "active" : ""} aria-current={activeTool === id ? "page" : undefined} onClick={() => setActiveTool(id)}><Icon size={18} /><span>{label}</span></button>)}</nav></aside><div className="admin-console-main">{activeTool ? toolContent : overview}</div></div>{reviewProperty && <AdminPropertyReview key={reviewProperty.id} property={properties.find((item) => item.id === reviewProperty.id) || reviewProperty} accounts={accounts} onClose={() => setReviewProperty(null)} onApprove={async (property, status) => { if (await setModerationStatus(property, status)) setReviewProperty(null); }} onRemove={async (property) => { if (await removeListing(property)) setReviewProperty(null); }} onSaveComments={saveModerationComments} onSendComments={sendModerationComments} />}</div>;
}

function Workspace({ user, setUser, view, setView, properties, setProperties, favorites, setFavorites, compareIds, setCompareIds, preferences, setPreferences, applications, setApplications, maintenanceRequests, setMaintenanceRequests, viewings, setViewings, messages, setMessages, onRoleChange }) {
  const [filters, setFilters] = useState({ query: "", location: "All locations", type: "All types", amenities: [], maxPrice: 30000, bedrooms: 0, availableOnly: false });
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [scheduleProperty, setScheduleProperty] = useState(null);
  const [messageTarget, setMessageTarget] = useState(null);
  const [editorProperty, setEditorProperty] = useState(undefined);
  const [toast, setToast] = useState("");
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2800); return () => window.clearTimeout(timer); }, [toast]);
  const notify = (message) => setToast(message);
  const getScore = (property) => getMatchScore(property, preferences);
  const save = (id) => { const active = favorites.includes(id); setFavorites(active ? favorites.filter((item) => item !== id) : [...favorites, id]); notify(active ? "Removed from your saved homes." : "Saved to your shortlist."); };
  const compare = (id) => { if (compareIds.includes(id)) { setCompareIds(compareIds.filter((item) => item !== id)); notify("Removed from comparison."); } else if (compareIds.length >= 3) notify("Compare up to three homes at a time."); else { setCompareIds([...compareIds, id]); notify("Added to your comparison."); } };
  const apply = async (property) => {
    if (applications.some((item) => item.propertyId === property.id && item.renterEmail === user.email && ["Pending", "Approved"].includes(item.status))) {
      notify("You already have an application for this home.");
      return;
    }
    try {
      const application = await apiRequest("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          name: user.name,
          renterEmail: user.email,
          date: new Intl.DateTimeFormat("en-PH", { month: "short", day: "2-digit", year: "numeric" }).format(new Date()),
        }),
      });
      setApplications((current) => [application, ...current]);
      setProperties((current) => current.map((item) => item.id === property.id ? { ...item, available: item.available !== false } : item));
      notify("Application submitted. A slot is only taken if the landlord approves it.");
    } catch (error) {
      notify(`Could not submit application: ${error.message}`);
    }
  };
  const confirmViewing = async (property, date, requestedTime, renterMessage) => {
    if (staticPreview) {
      notify("Viewing requests require the full RentMatch app.");
      return;
    }
    try {
      const request = await apiRequest("/api/viewings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          date,
          requestedTime,
          renterName: user.name,
          renterEmail: user.email,
          renterMessage,
        }),
      });
      setViewings((current) => [request, ...current.filter((item) => item.id !== request.id)]);
      const messageTime = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date());
      const requestMessage = `Viewing request for ${property.name}\nDate: ${date}\nPreferred time: ${requestedTime}\n${renterMessage}`;
      setMessages((current) => [
        ...current,
        { id: `${request.id}-renter`, person: request.hostName, from: user.name, sender: "me", text: requestMessage, time: messageTime, propertyId: property.id },
        { id: `${request.id}-host`, person: user.name, from: user.name, sender: "them", text: requestMessage, time: messageTime, propertyId: property.id },
      ]);
      setScheduleProperty(null);
      notify("Viewing request sent. The host can review it in Viewings.");
    } catch (error) {
      notify(`Could not schedule the viewing: ${error.message}`);
    }
  };
  const openViewingCalendar = (property) => {
    if (staticPreview) {
      notify("Viewing requests require the full RentMatch app.");
      return;
    }
    setScheduleProperty(property);
  };
  const startMessage = (property) => {
    const hostName = property.host || "Property host";
    const interestText = tenantInterestText(property.name);
    const alreadyInquired = messages.some((item) => item.person === hostName && item.propertyId === property.id && item.sender === "me");
    setSelectedProperty(null);
    setMessageTarget(hostName);
    setView("messages");
    if (alreadyInquired) return;
    const stamp = Date.now();
    setMessages((current) => [
      ...current,
      {
        id: `${stamp}-renter`,
        person: hostName,
        from: user.name,
        sender: "me",
        text: interestText,
        time: "Just now",
        propertyId: property.id,
        property: property.name,
      },
      {
        id: `${stamp}-host`,
        person: user.name,
        from: user.name,
        sender: "them",
        text: interestText,
        time: "Just now",
        propertyId: property.id,
        property: property.name,
      },
    ]);
  };
  const signOut = () => { setUser(null); setView("landing"); };
  const goToAdmin = () => { if (user.role === "admin") setView("admin"); };
  const goToPreferences = () => setView(user.role === "landlord" ? "profile" : "preferences");
  const ownProperties = properties.filter((property) => property.ownerEmail === user.email);
  const displayedHostProperties = ownProperties;
  const renterProperties = properties.filter((property) => property.moderationStatus === "Approved" && !property.isDraft && property.available !== false && (!Number.isInteger(property.units) || property.units > 0));
  const visibleApplications = user.role === "landlord"
    ? applications
    : applications.filter((application) => application.renterEmail === user.email);
  const ownPropertyIds = new Set(ownProperties.map((property) => property.id));
  const applicants = applications
    .filter((application) => user.role !== "landlord" || ownPropertyIds.has(application.propertyId))
    .map((application) => ({
      ...application,
      property: application.property || properties.find((property) => property.id === application.propertyId)?.name || "Rental listing",
    }));
  const hostMaintenancePropertyIds = new Set(properties
    .filter((property) => property.ownerEmail === user.email || property.host === user.name)
    .map((property) => property.id));
  const hostPropertyIds = new Set(properties
    .filter((property) => property.ownerEmail?.toLowerCase() === user.email.toLowerCase() || property.host === user.name)
    .map((property) => property.id));
  const hostViewings = user.role === "landlord"
    ? viewings.filter((viewing) => hostPropertyIds.has(viewing.propertyId))
    : [];
  const renterViewings = viewings.filter((viewing) => viewing.renterEmail?.toLowerCase() === user.email.toLowerCase());
  const viewingNotifications = user.role === "landlord"
    ? hostViewings
      .filter((viewing) => (viewing.status || "Pending") === "Pending")
      .map((viewing) => ({
        id: `viewing-request-${viewing.id}`,
        title: "New viewing request",
        detail: `${viewing.renterName || "A renter"} · ${viewing.propertyName || properties.find((property) => property.id === viewing.propertyId)?.name || "Your property"} · ${viewing.date} at ${viewing.requestedTime || viewing.time || "time not specified"}`,
        view: "viewings",
      }))
    : user.role === "renter"
      ? renterViewings
        .filter((viewing) => viewing.status === "Available" || viewing.status === "Unavailable")
        .map((viewing) => ({
          id: `viewing-response-${viewing.id}-${viewing.hostRespondedAt || viewing.status}`,
          title: `Host ${viewing.status === "Available" ? "confirmed" : "declined"} your viewing`,
          detail: `${viewing.propertyName || properties.find((property) => property.id === viewing.propertyId)?.name || "Rental property"} · ${viewing.date} at ${viewing.requestedTime || viewing.time || "time not specified"}${viewing.hostComment ? ` · ${viewing.hostComment}` : ""}`,
          view: "applications",
        }))
      : [];
  const respondToViewing = async (request, status, comment) => {
    const property = properties.find((item) => item.id === request.propertyId);
    if (!property) {
      notify("The property for this viewing request could not be found.");
      return;
    }
    try {
      const updatedRequest = await apiRequest(`/api/viewings/${encodeURIComponent(request.id)}/response`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, hostComment: comment }),
      });
      setViewings((current) => current.map((item) => item.id === request.id ? updatedRequest : item));
      const updatedAt = new Date();
      const messageTime = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(updatedAt);
      const reply = `Viewing request for ${property.name}: ${status === "Available" ? "Available" : "Not available"}.\n${comment}`;
      setMessages((current) => [
        ...current,
        { id: `${request.id}-host-reply-${updatedAt.getTime()}-renter`, person: request.renterName, from: user.name, sender: "them", text: reply, time: messageTime, propertyId: property.id },
        { id: `${request.id}-host-reply-${updatedAt.getTime()}-host`, person: request.hostName || property.host || user.name, from: user.name, sender: "me", text: reply, time: messageTime, propertyId: property.id },
      ]);
      notify(`Your ${status.toLowerCase()} response was sent to ${request.renterName || "the renter"} in Messages.`);
    } catch (error) {
      notify(`Could not respond to the viewing: ${error.message}`);
    }
  };
  const visibleMaintenanceRequests = user.role === "landlord"
    ? maintenanceRequests.filter((request) => hostMaintenancePropertyIds.has(request.propertyId))
    : maintenanceRequests.filter((request) => request.renterEmail?.toLowerCase() === user.email.toLowerCase());
  const currentPropertyForDetail = selectedProperty && properties.find((property) => property.id === selectedProperty.id) || selectedProperty;
  const updateApplicant = async (id, status) => {
    try {
      const result = await apiRequest(`/api/applications/${encodeURIComponent(id)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setApplications((current) => current.map((application) => application.id === result.application.id ? result.application : application));
      if (result.property) {
        setProperties((current) => current.map((property) => property.id === result.property.id ? result.property : property));
      }
      notify(status === "Approved" ? "Application approved; one available slot has been reserved." : "Application declined.");
    } catch (error) {
      notify(`Could not update application: ${error.message}`);
    }
  };
  const applicantMessage = (name) => {
    setMessageTarget(name);
    setView("messages");
    if (!messages.some((message) => message.person === name)) {
      setMessages([...messages, { id: Date.now(), person: name, from: name, sender: "them", text: "Hi, thanks for reaching out. How can I help with your rental search?", time: "Just now" }]);
    }
  };
  const createMaintenanceRequest = async (request) => {
    try {
      const savedRequest = await apiRequest("/api/maintenance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, renterName: user.name, renterEmail: user.email }),
      });
      setMaintenanceRequests((current) => [savedRequest, ...current]);
      notify("Maintenance request sent to the landlord.");
      return savedRequest;
    } catch (error) {
      notify(`Could not send maintenance request: ${error.message}`);
      throw error;
    }
  };
  const updateMaintenanceStatus = async (id, status) => {
    try {
      const updatedRequest = await apiRequest(`/api/maintenance-requests/${encodeURIComponent(id)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setMaintenanceRequests((current) => current.map((request) => request.id === updatedRequest.id ? updatedRequest : request));
      notify(`Maintenance request marked ${status.toLowerCase()}.`);
    } catch (error) {
      notify(`Could not update maintenance request: ${error.message}`);
    }
  };
  const removeMaintenanceRequest = async (request) => {
    if (!window.confirm(`Remove the maintenance request "${request.title}"?`)) {
      return;
    }

    try {
      await apiRequest(`/api/maintenance-requests/${encodeURIComponent(request.id)}?renterEmail=${encodeURIComponent(user.email)}`, {
        method: "DELETE",
      });
      setMaintenanceRequests((current) => current.filter((item) => item.id !== request.id));
      notify("Maintenance request removed.");
    } catch (error) {
      notify(`Could not remove maintenance request: ${error.message}`);
    }
  };
  const saveProperty = async (newProperty) => {
    const propertyToSave = {
      ...newProperty,
      isMine: true,
      ownerEmail: user.email,
      host: newProperty.host || user.name || "Property host",
      hostEmail: newProperty.hostEmail || user.email,
      moderationStatus: newProperty.moderationStatus || "Needs review",
      createdAt: newProperty.createdAt || new Date().toISOString(),
    };
    const listing = await apiRequest(`/api/properties/${encodeURIComponent(newProperty.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(propertyToSave),
    });
    setProperties((current) => {
      const exists = current.some((item) => item.id === listing.id);
      return exists
        ? current.map((item) => item.id === listing.id ? listing : item)
        : [listing, ...current];
    });

    try {
      await apiRequest("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name || "Property host",
          email: user.email,
          role: "Property host",
          status: "Verified",
        }),
      });
    } catch {
      // Best-effort
    }
  };
  const removeProperty = async (property) => {
    if (property.ownerEmail?.toLowerCase() !== user.email.toLowerCase()) {
      notify("You can only remove your own listings.");
      return;
    }

    try {
      await apiRequest(`/api/properties/${encodeURIComponent(property.id)}`, { method: "DELETE" });
      setProperties((current) => current.filter((item) => item.id !== property.id));
      notify(`${property.name} was removed from your listings.`);
    } catch (error) {
      notify(`Could not remove the listing: ${error.message}`);
    }
  };
  const openSlot = async (property) => {
    try {
      const updated = await apiRequest(`/api/properties/${encodeURIComponent(property.id)}/slots/open`, { method: "POST" });
      setProperties((current) => current.map((item) => item.id === updated.id ? updated : item));
      notify(`${property.name} is visible to renters with ${updated.units} slot${updated.units === 1 ? "" : "s"} available.`);
    } catch (error) {
      notify(`Could not open a slot: ${error.message}`);
    }
  };
  let content;
  if (user.role === "admin") {
    content = <AdminPage properties={properties} setProperties={setProperties} onToast={notify} />;
  } else if (user.role === "landlord") {
    if (view === "listings") content = <HostListings properties={displayedHostProperties} onNewListing={() => setEditorProperty(null)} onEdit={(property) => setEditorProperty(property)} onOpenSlot={openSlot} onRemove={removeProperty} onToast={notify} />;
    else if (view === "applicants") content = <div className="workspace-content"><SectionHeading eyebrow="APPLICANT MANAGEMENT" title="Renter applications" detail="A slot is reserved only after you approve an application." action={<span className="listing-counter">{applicants.filter((applicant) => applicant.status === "Pending").length} awaiting review</span>} /><section className="surface-panel full-applicants"><div className="surface-panel-heading"><div><h2>Applications for your listings</h2><p>Only renter applications for your properties are shown here.</p></div></div><ApplicantRows applicants={applicants} onDecision={updateApplicant} onMessage={applicantMessage} /></section></div>;
    else if (view === "viewings") content = <HostViewingRequests viewings={hostViewings} properties={properties.filter((property) => hostPropertyIds.has(property.id))} onRespond={respondToViewing} />;
    else if (view === "maintenance") content = <MaintenanceRequestsPage mode="landlord" requests={visibleMaintenanceRequests} properties={[]} onUpdateStatus={updateMaintenanceStatus} />;
    else if (view === "messages") content = <MessagesPage messages={messages} setMessages={setMessages} user={user} properties={properties} onToast={notify} activePerson={messageTarget} />;
    else if (view === "profile") content = <div className="workspace-content"><SectionHeading eyebrow="YOUR HOST PROFILE" title="Profile & verification" detail="Keep your host information complete and up to date." /><div className="profile-edit surface-panel"><span className="profile-large-avatar">{user.name.charAt(0)}</span><div><h2>{user.name}</h2><p>{user.email}</p><span className="status-pill status-in-review"><ShieldCheck size={13} /> Identity review required</span></div><Button variant="outline" onClick={() => notify("Host verification documents can be submitted after backend setup.")}><Upload size={15} /> Upload ID</Button></div></div>;
    else content = <HostDashboard properties={displayedHostProperties} applicants={applicants} maintenanceRequests={visibleMaintenanceRequests} onNavigate={setView} onNewListing={() => setEditorProperty(null)} />;
  } else {
    if (view === "search") content = <SearchPage properties={renterProperties} filters={filters} setFilters={setFilters} favorites={favorites} compareIds={compareIds} onSave={save} onCompare={compare} onOpen={setSelectedProperty} getScore={getScore} onToast={notify} />;
    else if (view === "compare") content = <ComparisonPage properties={renterProperties} compareIds={compareIds} onRemove={(id) => setCompareIds(compareIds.filter((item) => item !== id))} onBrowse={() => setView("search")} getScore={getScore} onOpen={setSelectedProperty} />;
    else if (view === "saved") content = <SavedPage properties={renterProperties} favorites={favorites} onSave={save} onCompare={compare} compareIds={compareIds} onOpen={setSelectedProperty} getScore={getScore} onBrowse={() => setView("search")} />;
    else if (view === "maintenance") content = <MaintenanceRequestsPage mode="renter" requests={visibleMaintenanceRequests} properties={properties} onCreate={createMaintenanceRequest} onUpdateStatus={updateMaintenanceStatus} onRemove={removeMaintenanceRequest} />;
    else if (view === "messages") content = <MessagesPage messages={messages} setMessages={setMessages} user={user} properties={properties} onToast={notify} activePerson={messageTarget} />;
    else if (view === "preferences") content = <PreferencesPage preferences={preferences} setPreferences={setPreferences} onToast={notify} />;
    else if (view === "applications") content = <ApplicationsPage applications={visibleApplications} viewings={renterViewings} properties={properties} onBrowse={() => setView("search")} />;
    else content = <HomeDashboard user={user} properties={renterProperties} preferences={preferences} favorites={favorites} applications={visibleApplications} viewings={viewings} onNavigate={setView} onOpen={setSelectedProperty} onSave={save} onCompare={compare} compareIds={compareIds} getScore={getScore} />;
  }
  return (
    <>
      {staticPreview && (
        <div className="static-preview-notice" role="status">
          Static preview: browsing and demo sign-in are available; server-backed actions require the full RentMatch app.
        </div>
      )}
      <div className={`workspace ${user.role === "admin" ? "admin-workspace" : user.role === "landlord" ? "landlord-workspace" : "renter-workspace"}`}><AppHeader user={{ ...user, compareCount: compareIds.length }} view={view} setView={setView} onLogout={signOut} onPreferences={goToPreferences} onAdmin={goToAdmin} onRoleChange={onRoleChange} notifications={viewingNotifications} /><main className="workspace-main">{content}<footer className="workspace-footer"><span>© 2026 RentMatch · Batangas City</span><span>Sample listings and account data for product preview</span></footer></main>
      {selectedProperty && currentPropertyForDetail && <PropertyDetails property={currentPropertyForDetail} score={getScore(currentPropertyForDetail)} saved={favorites.includes(currentPropertyForDetail.id)} compared={compareIds.includes(currentPropertyForDetail.id)} viewingRequested={viewings.some((item) => item.propertyId === currentPropertyForDetail.id && item.renterEmail === user.email && item.status !== "Unavailable")} onClose={() => setSelectedProperty(null)} onSave={() => save(currentPropertyForDetail.id)} onCompare={() => compare(currentPropertyForDetail.id)} onApply={() => apply(currentPropertyForDetail)} onSchedule={() => openViewingCalendar(currentPropertyForDetail)} onMessage={() => startMessage(currentPropertyForDetail)} />}
      {scheduleProperty && <ViewingCalendar property={scheduleProperty} viewings={viewings} onClose={() => setScheduleProperty(null)} onConfirm={(date, time, message) => confirmViewing(scheduleProperty, date, time, message)} />}
      {editorProperty !== undefined && <PropertyEditor property={editorProperty} onClose={() => setEditorProperty(undefined)} onSave={saveProperty} onToast={notify} />}
      {toast && <div className="toast" role="status" aria-live="polite"><CheckCircle2 size={17} />{toast}</div>}
      </div>
    </>
  );
}

export default function App() {
  const [user, setUser] = useStoredState("rentmatch-user", null);
  const [properties, setProperties] = useStoredState("rentmatch-properties", initialProperties);
  const [favorites, setFavorites] = useStoredState("rentmatch-favorites", []);
  const [compareIds, setCompareIds] = useStoredState("rentmatch-compare", []);
  const [preferences, setPreferences] = useStoredState("rentmatch-preferences", defaultPreferences);
  const [applications, setApplications] = useState([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);
  const [viewings, setViewings] = useStoredState("rentmatch-viewings", []);
  const [messages, setMessages] = useStoredState("rentmatch-messages", [{ id: "welcome-message", person: "Maya Santos", property: "Anyayahan Apartment", propertyId: "anyayahan-apartment", from: "Gabriela Ramos", sender: "me", text: "Hi! I'm interested in Anyayahan Apartment. Could you tell me more about availability and viewing options?", time: "9:42 AM" }]);
  const [view, setView] = useState(user ? "dashboard" : "landing");
  const [role, setRole] = useState("renter");
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    if (staticPreview) return;
    let cancelled = false;
    let loading = false;
    let refreshTimer;
    const loadProperties = async (syncSeedListings = false) => {
      if (loading) return;
      loading = true;
      try {
        let serverProperties = await apiRequest("/api/properties");
          if (syncSeedListings) {
          serverProperties = await apiRequest("/api/properties/seed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(properties),
          });
        }
        if (!cancelled) setProperties(serverProperties);
      } catch (error) {
        console.error("Could not load rental listings from the backend.", error);
      } finally {
        loading = false;
        if (!cancelled) refreshTimer = window.setTimeout(() => loadProperties(), 10000);
      }
    };
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(refreshTimer);
        loadProperties();
      }
    };
    loadProperties(true);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);
  useEffect(() => {
    if (staticPreview) return;
    let cancelled = false;
    apiRequest("/api/applications")
      .then((serverApplications) => {
        if (!cancelled) setApplications(serverApplications);
      })
      .catch((error) => {
        console.error("Could not load rental applications from the backend.", error);
      });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (staticPreview) return;
    let cancelled = false;
    apiRequest("/api/maintenance-requests")
      .then((serverRequests) => {
        if (!cancelled) setMaintenanceRequests(serverRequests);
      })
      .catch((error) => {
        console.error("Could not load maintenance requests from the backend.", error);
      });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
      if (staticPreview) return;
      let cancelled = false;
      let loading = false;
      let refreshTimer;
      const loadViewings = async () => {
        if (loading) return;
        loading = true;
        try {
          const serverViewings = await apiRequest("/api/viewings");
          if (!cancelled) setViewings(serverViewings);
        } catch (error) {
          console.error("Could not load viewing requests from the backend.", error);
        } finally {
          loading = false;
          if (!cancelled) refreshTimer = window.setTimeout(loadViewings, 10000);
        }
      };
      const refreshOnFocus = () => {
        if (document.visibilityState === "visible") {
          window.clearTimeout(refreshTimer);
          loadViewings();
        }
      };
      loadViewings();
      window.addEventListener("focus", refreshOnFocus);
      return () => {
        cancelled = true;
        window.clearTimeout(refreshTimer);
        window.removeEventListener("focus", refreshOnFocus);
      };
  }, []);
  const openAuth = (nextRole, mode = "login") => { setRole(nextRole); setAuthMode(mode); setAuthError(""); setView("auth"); window.scrollTo(0, 0); };
  const finishLogin = (name, email, selectedRole, school = "") => { const account = { name: name || email.split("@")[0], email, role: selectedRole, ...(school ? { school } : {}) }; setUser(account); setView(selectedRole === "admin" ? "admin" : "dashboard"); window.scrollTo(0, 0); };
  const submitAuth = (event) => { event.preventDefault(); const values = new FormData(event.currentTarget); const email = values.get("email").toString().trim().toLowerCase(); const password = values.get("password").toString(); if (authMode === "login" && email === adminDemoAccount.email) { if (password !== adminDemoAccount.password) { setAuthError("The admin demo email or password is incorrect."); return; } finishLogin(adminDemoAccount.name, email, "admin"); return; } if (authMode === "login" && email === landlordDemoAccount.email) { if (password !== landlordDemoAccount.password) { setAuthError("The landlord demo email or password is incorrect."); return; } finishLogin(landlordDemoAccount.name, email, "landlord"); return; } if (authMode === "register" && [adminDemoAccount.email, landlordDemoAccount.email].includes(email)) { setAuthError("This email is reserved for a demo account."); return; } if (authMode === "register" && !/^[0-9+ ()-]{7,}$/.test(values.get("phone")?.toString() || "")) { setAuthError("Enter a valid contact number."); return; } if (authMode === "register" && password !== values.get("confirmPassword")) { setAuthError("Those passwords do not match. Please try again."); return; } if (password.length < 8) { setAuthError("Use a password with at least 8 characters."); return; } const name = values.get("name")?.toString() || email.split("@")[0]; if (authMode === "register" && role === "renter") setPreferences({ ...preferences, location: values.get("preferredLocation") || preferences.location, budget: Number(values.get("budget")) || preferences.budget }); finishLogin(name, email, role, authMode === "register" && role === "renter" ? values.get("school")?.toString().trim() : ""); };
  if (user && view !== "landing" && view !== "auth") return <Workspace user={user} setUser={setUser} view={view} setView={setView} properties={properties} setProperties={setProperties} favorites={favorites} setFavorites={setFavorites} compareIds={compareIds} setCompareIds={setCompareIds} preferences={preferences} setPreferences={setPreferences} applications={applications} setApplications={setApplications} maintenanceRequests={maintenanceRequests} setMaintenanceRequests={setMaintenanceRequests} viewings={viewings} setViewings={setViewings} messages={messages} setMessages={setMessages} onRoleChange={() => { setUser(null); setView("landing"); }} />;
  if (view === "auth") return <AuthScreen role={role} mode={authMode} setMode={(mode) => { setAuthMode(mode); setAuthError(""); }} onRoleChange={setRole} onBack={() => setView("landing")} onSubmit={submitAuth} error={authError} onDemo={() => finishLogin(role === "landlord" ? landlordDemoAccount.name : "Gabriela Ramos", role === "landlord" ? landlordDemoAccount.email : "gabriela.ramos@example.com", role)} />;
  return <Landing properties={properties} onRole={(nextRole) => openAuth(nextRole)} onLogin={() => openAuth("renter")} onRegister={() => openAuth("renter", "register")} onBrowse={(nextRole) => openAuth(nextRole, "login")} />;
}
