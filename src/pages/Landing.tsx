import { useNavigate } from 'react-router-dom';
import { Code2, ArrowRight, Zap, RefreshCw, Play } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-8 relative">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
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
      </main>

      {/* Features */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: 'Instant Translation', desc: 'Convert code across 4 languages in one click' },
            { icon: RefreshCw, title: 'AI Verification', desc: 'Verify and auto-fix translated code for correctness' },
            { icon: Play, title: 'Live Execution', desc: 'Run all language versions and compare outputs' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-panel p-6 text-center">
              <Icon className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="text-foreground font-semibold mb-1">{title}</h3>
              <p className="text-muted-foreground text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Landing;
