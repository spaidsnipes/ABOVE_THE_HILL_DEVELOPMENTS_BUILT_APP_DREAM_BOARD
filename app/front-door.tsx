"use client";

type FrontDoorProps = {
  onEnter: () => void;
};

/** Public entry point. It intentionally contains no invented project data. */
export function FrontDoor({ onEnter }: FrontDoorProps) {
  const showPrivacy = () => document.getElementById("front-door-privacy")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return <main className="front-door">
    <div className="front-door-glow front-door-glow-one" aria-hidden="true" />
    <div className="front-door-glow front-door-glow-two" aria-hidden="true" />
    <nav className="front-door-nav" aria-label="Dreamboard public navigation">
      <button className="front-door-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to Dreamboard welcome">
        <span className="front-door-mark">✦</span><span><b>DREAMBOARD</b><small>BY WOW WORLD</small></span>
      </button>
      <button className="front-door-signin" onClick={onEnter}>Passport sign in <span>→</span></button>
    </nav>

    <section className="front-door-hero" aria-labelledby="front-door-title">
      <p className="front-door-kicker">A PRIVATE CREATIVE OPERATING SYSTEM</p>
      <h1 id="front-door-title">Write the vision.<br /><em>Make it plain.</em></h1>
      <p className="front-door-lede">A calm, protected place to gather years of material, discover the shape of your work, and carry it toward a finished creation—at your pace.</p>
      <div className="front-door-actions">
        <button className="front-door-primary" onClick={onEnter}>Enter Dreamboard <span>→</span></button>
        <button className="front-door-secondary" onClick={showPrivacy}>How your work stays yours</button>
      </div>
      <p className="front-door-note">No project is waiting here under your name. Your private workspace begins after you enter with a Passport.</p>
    </section>

    <section className="front-door-path" aria-label="The Dreamboard creative path">
      <div><span>01</span><h2>Capture</h2><p>Bring in the thought before it disappears.</p></div>
      <div><span>02</span><h2>Connect</h2><p>Keep sources, projects, and versions in their true relationships.</p></div>
      <div><span>03</span><h2>Create</h2><p>Move from material to the work only you can make.</p></div>
    </section>

    <section className="front-door-privacy" id="front-door-privacy" aria-labelledby="front-door-privacy-title">
      <p className="front-door-kicker">THE CREATOR REMAINS THE CREATOR</p>
      <h2 id="front-door-privacy-title">Your work begins private.</h2>
      <p>Dreamboard does not invent a life story, project, or audience for you. Your Passport is the consent boundary for cloud work. You choose what to import, what to connect, and what—if anything—to share through WOW World.</p>
      <button className="front-door-text" onClick={onEnter}>Create or sign in with a Passport <span>→</span></button>
    </section>
  </main>;
}
