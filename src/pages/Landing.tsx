import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, ArrowRight, Zap, RefreshCw, Play, FileCode, Braces, Hash, Coffee, ChevronRight, Shield, Gauge, Menu, X } from 'lucide-react';

const languages = [
  { icon: FileCode, name: 'Python', color: 'text-yellow-400', sample: 'print("Hello World")' },
  { icon: Braces, name: 'C', color: 'text-blue-400', sample: 'printf("Hello World\\n");' },
  { icon: Hash, name: 'C++', color: 'text-sky-400', sample: 'cout << "Hello World" << endl;' },
  { icon: Coffee, name: 'Java', color: 'text-orange-400', sample: 'System.out.println("Hello World");' },
];

const steps = [
  { step: '1', title: 'Paste Your Code', desc: 'Write or paste code in any of the 4 supported languages.' },
  { step: '2', title: 'Translate Instantly', desc: 'Click "Translate All" to convert to every other language at once.' },
  { step: '3', title: 'Verify & Run', desc: 'AI-verify correctness, then execute all versions side by side.' },
];

const navLinks = [
  { label: 'Languages', href: '#languages' },
  { label: 'Demo', href: '#demo' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
];

const Landing = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (href: string) => {
    setMobileMenuOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2">
            <Code2 className="w-6 h-6 text-primary" />
            <span className="font-bold text-foreground text-lg">Code Transpiler</span>
          </button>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(({ label, href }) => (
              <button key={href} onClick={() => scrollTo(href)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {label}
              </button>
            ))}
            <button
              onClick={() => navigate('/app')}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Open App
            </button>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden text-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-3">
            {navLinks.map(({ label, href }) => (
              <button key={href} onClick={() => scrollTo(href)} className="text-sm text-muted-foreground hover:text-foreground text-left transition-colors">
                {label}
              </button>
            ))}
            <button
              onClick={() => { setMobileMenuOpen(false); navigate('/app'); }}
              className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold text-center"
            >
              Open App
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <header className="flex-1 flex flex-col items-center justify-center px-6 text-center py-24">
        <div className="mb-8 relative">
          <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-primary/20 blur-2xl animate-pulse-slow" />
          <div className="relative w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
            <Code2 className="w-10 h-10 text-primary" />
          </div>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 tracking-tight">
          Code <span className="text-gradient-primary">Transpiler</span>
        </h1>

        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mb-12 leading-relaxed">
          Seamlessly convert code between <strong className="text-foreground">C</strong>,{' '}
          <strong className="text-foreground">C++</strong>,{' '}
          <strong className="text-foreground">Java</strong>, and{' '}
          <strong className="text-foreground">Python</strong> — instantly.
        </p>

        <button
          onClick={() => navigate('/app')}
          className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg transition-all hover:scale-105 glow-primary hover:shadow-[0_0_60px_hsl(174_72%_50%/0.4)]"
        >
          Try our code transpiler
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>
      </header>

      {/* Supported Languages */}
      <section id="languages" className="px-6 py-16 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-3">
            4 Languages, <span className="text-gradient-primary">One Click</span>
          </h2>
          <p className="text-muted-foreground text-center mb-10 max-w-lg mx-auto">
            Write in one language and get working code in all the others.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {languages.map(({ icon: Icon, name, color, sample }) => (
              <div key={name} className="glass-panel p-5 group hover:border-primary/40 transition-all">
                <Icon className={`w-8 h-8 ${color} mb-3`} />
                <h3 className="text-foreground font-semibold mb-2">{name}</h3>
                <code className="text-xs text-muted-foreground font-mono block truncate">{sample}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Preview */}
      <section id="demo" className="px-6 py-16 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-3">
            See It In <span className="text-gradient-primary">Action</span>
          </h2>
          <p className="text-muted-foreground text-center mb-10 max-w-lg mx-auto">
            Translate Python to C, C++, and Java simultaneously.
          </p>

          <div className="glass-panel p-1 rounded-xl overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/30 rounded-lg overflow-hidden">
              <div className="bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary text-primary-foreground">Source · Python</span>
                </div>
                <pre className="text-sm font-mono text-foreground leading-relaxed">
                  <span className="syntax-keyword">for</span> <span className="syntax-variable">i</span> <span className="syntax-keyword">in</span> <span className="syntax-function">range</span>(<span className="syntax-number">5</span>):{'\n'}
                  {'    '}<span className="syntax-function">print</span>(<span className="syntax-string">"Hello"</span>, <span className="syntax-variable">i</span>)
                </pre>
              </div>
              <div className="bg-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">Output · C++</span>
                </div>
                <pre className="text-sm font-mono text-foreground leading-relaxed">
                  <span className="syntax-keyword">for</span> (<span className="syntax-type">int</span> <span className="syntax-variable">i</span> <span className="syntax-operator">=</span> <span className="syntax-number">0</span>; <span className="syntax-variable">i</span> <span className="syntax-operator">&lt;</span> <span className="syntax-number">5</span>; <span className="syntax-variable">i</span><span className="syntax-operator">++</span>) {'{'}{'\n'}
                  {'    '}<span className="syntax-variable">cout</span> <span className="syntax-operator">&lt;&lt;</span> <span className="syntax-string">"Hello "</span> <span className="syntax-operator">&lt;&lt;</span> <span className="syntax-variable">i</span> <span className="syntax-operator">&lt;&lt;</span> <span className="syntax-variable">endl</span>;{'\n'}
                  {'}'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-6 py-16 border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-10">
            How It <span className="text-gradient-primary">Works</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map(({ step, title, desc }) => (
              <div key={step} className="relative glass-panel p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mx-auto mb-4">
                  <span className="text-primary font-bold">{step}</span>
                </div>
                <h3 className="text-foreground font-semibold mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-16 border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-10">
            Powerful <span className="text-gradient-primary">Features</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Zap, title: 'Instant Translation', desc: 'Convert code across 4 languages in one click' },
              { icon: Shield, title: 'AI Verification', desc: 'AI-powered review catches bugs and auto-fixes issues' },
              { icon: Play, title: 'Live Execution', desc: 'Run all language versions and compare outputs side by side' },
              { icon: Gauge, title: 'Zero Setup', desc: 'No accounts, no installs — just paste and translate' },
              { icon: RefreshCw, title: 'Auto Correction', desc: 'Detected issues are automatically corrected in the output' },
              { icon: Code2, title: 'Syntax Highlighted', desc: 'Clean, readable output with full syntax highlighting' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-panel p-6 text-center hover:border-primary/30 transition-all">
                <Icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="text-foreground font-semibold mb-1">{title}</h3>
                <p className="text-muted-foreground text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 border-t border-border/50">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Ready to transpile your code?
          </h2>
          <p className="text-muted-foreground mb-8">
            No signup required. Start converting code in seconds.
          </p>
          <button
            onClick={() => navigate('/app')}
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg transition-all hover:scale-105 glow-primary"
          >
            Get Started
            <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border/50 text-center">
        <p className="text-muted-foreground text-sm">
          Code Transpiler — Convert between C, C++, Java & Python instantly.
        </p>
      </footer>
    </div>
  );
};

export default Landing;
