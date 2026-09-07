import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { BarChart3, Sparkles, UsersRound } from "lucide-react";
import { useI18n } from "@/i18n";
import { LanguageSelector } from "@/shared/components/ui/LanguageSelector";

interface AuthShellProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  compact?: boolean;
  visualMode?: "access" | "onboarding" | "neutral";
}

const visualContent = {
  access: {
    vi: ["Mọi quan hệ.", "Một nhịp làm việc."],
    en: ["Every relationship.", "One clear rhythm."],
  },
  onboarding: {
    vi: ["Bắt đầu nhẹ nhàng.", "Lớn lên theo cách của bạn."],
    en: ["Start with clarity.", "Grow in your own way."],
  },
  neutral: {
    vi: ["Mọi thứ sẵn sàng.", "Bắt đầu ngay."],
    en: ["Everything is ready.", "Start right away."],
  },
} as const;

const headlineContainerMotion = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
} as const;

const headlineLineMotion = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
} as const;

const visualTiles = [
  { Icon: UsersRound, className: "left-[8%] top-[24%] bg-white text-indigo-600 shadow-indigo-100/80" },
  { Icon: BarChart3, className: "right-[10%] top-[12%] bg-violet-100 text-violet-600 shadow-violet-100/80" },
  { Icon: Sparkles, className: "right-[18%] bottom-[10%] bg-cyan-100 text-cyan-700 shadow-cyan-100/80" },
] as const;

export const AuthShell: React.FC<AuthShellProps> = ({
  title,
  children,
  footer,
  compact = false,
  visualMode = "neutral",
}) => {
  const { locale, setLocale } = useI18n();
  const vi = locale === "vi";
  const reduceMotion = useReducedMotion();
  const visual = visualContent[visualMode][vi ? "vi" : "en"];

  return (
    <main data-auth-shell="true" className="relative min-h-[100dvh] overflow-x-hidden bg-[#f6f7fb] text-slate-900">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_10%_18%,rgba(125,211,252,.22),transparent_26%),radial-gradient(circle_at_86%_10%,rgba(196,181,253,.28),transparent_27%),radial-gradient(circle_at_54%_92%,rgba(165,243,252,.2),transparent_25%)]" />
      <motion.div
        aria-hidden="true"
        className="absolute -left-24 bottom-[8%] h-72 w-72 rounded-full bg-indigo-200/30 blur-[90px]"
        animate={reduceMotion ? undefined : { x: [0, 42, 0], y: [0, -22, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute -right-24 top-[18%] h-80 w-80 rounded-full bg-cyan-200/35 blur-[100px]"
        animate={reduceMotion ? undefined : { x: [0, -36, 0], y: [0, 28, 0], scale: [1.04, 0.96, 1.04] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10 xl:px-14">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-sm font-semibold text-white shadow-lg shadow-indigo-200/70">
            <span className="relative z-10">U</span>
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 bg-white/25"
              animate={reduceMotion ? undefined : { x: ["-120%", "140%"] }}
              transition={{ duration: 3.6, repeat: Infinity, repeatDelay: 3.2, ease: "easeInOut" }}
            />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-950">UnicoreCRM</div>
            <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-slate-400">
              {vi ? "Quản trị quan hệ khách hàng" : "Customer relationship workspace"}
            </div>
          </div>
        </div>

        <LanguageSelector
          locale={locale}
          setLocale={setLocale}
          buttonClassName="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-slate-500 outline-none transition hover:bg-white/80 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-500/30"
          containerClassName="relative rounded-2xl border border-white/80 bg-white/75 p-1 shadow-sm shadow-slate-200/60 backdrop-blur-xl"
        />
      </header>

      <div className="relative z-10 mx-auto grid min-h-[100dvh] w-full max-w-[1480px] items-center gap-10 px-5 pb-8 pt-28 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.78fr)] lg:px-10 lg:pb-12 lg:pt-24 xl:gap-16 xl:px-14">
        <section className="relative hidden min-h-[620px] overflow-hidden rounded-[42px] border border-white/80 bg-gradient-to-br from-indigo-50/90 via-white/80 to-cyan-50/90 p-10 shadow-[0_30px_100px_-55px_rgba(79,70,229,.45)] backdrop-blur-xl lg:flex lg:flex-col lg:justify-center xl:p-14">
          <div aria-hidden="true" className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(99,102,241,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,.055)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:radial-gradient(circle_at_center,black,transparent_82%)]" />
          <motion.div
            aria-hidden="true"
            className="absolute left-[14%] top-[18%] h-64 w-64 rounded-full bg-gradient-to-br from-indigo-200/65 via-violet-100/70 to-cyan-100/80 blur-[2px]"
            animate={reduceMotion ? undefined : { scale: [1, 1.06, 1], rotate: [0, 8, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.div
            className="relative z-10 max-w-xl"
            variants={reduceMotion ? undefined : headlineContainerMotion}
            initial={reduceMotion ? false : "hidden"}
            animate={reduceMotion ? undefined : "visible"}
          >
            <h2
              data-auth-headline="true"
              className="text-balance text-[clamp(2.6rem,4.2vw,4.8rem)] font-semibold leading-[1.14] tracking-[-0.045em] text-slate-950"
            >
              <motion.span
                data-auth-headline-line="primary"
                className="block overflow-visible py-[0.08em]"
                variants={reduceMotion ? undefined : headlineLineMotion}
                transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
              >
                {visual[0]}
              </motion.span>
              <motion.span
                data-auth-headline-line="accent"
                className="relative mt-[-0.02em] block overflow-visible py-[0.1em]"
                variants={reduceMotion ? undefined : headlineLineMotion}
                transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.span
                  className="block bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-600 bg-[length:220%_100%] bg-clip-text text-transparent"
                  animate={reduceMotion ? undefined : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                  transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                >
                  {visual[1]}
                </motion.span>
                <motion.span
                  aria-hidden="true"
                  className="mt-3 block h-1 w-24 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 opacity-70"
                  initial={reduceMotion ? false : { scaleX: 0, transformOrigin: "left" }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.7, delay: 0.34, ease: [0.22, 1, 0.36, 1] }}
                />
              </motion.span>
            </h2>
          </motion.div>

          <div className="relative z-10 mt-16 h-64">
            <div aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <motion.div
                className="flex h-28 w-28 items-center justify-center rounded-[34px] bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-3xl font-semibold text-white shadow-[0_28px_55px_-18px_rgba(79,70,229,.5)]"
                animate={reduceMotion ? undefined : { y: [0, -9, 0], rotate: [0, 2.5, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
              >
                U
              </motion.div>
            </div>
            {visualTiles.map(({ Icon, className }, index) => (
              <motion.div
                key={className}
                aria-hidden="true"
                className={`absolute flex h-16 w-16 items-center justify-center rounded-[22px] shadow-xl ${className}`}
                animate={reduceMotion ? undefined : { y: [0, index % 2 === 0 ? -12 : 10, 0], rotate: [0, index % 2 === 0 ? -4 : 4, 0] }}
                transition={{ duration: 6.5 + index, repeat: Infinity, ease: "easeInOut", delay: index * 0.45 }}
              >
                <Icon size={25} strokeWidth={1.8} />
              </motion.div>
            ))}
          </div>
        </section>

        <section className="flex min-w-0 items-center justify-center">
          <motion.div
            className={`w-full ${compact ? "max-w-[430px]" : "max-w-[500px]"}`}
            initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rounded-[32px] border border-white/90 bg-white/90 p-6 shadow-[0_32px_90px_-42px_rgba(15,23,42,.38)] ring-1 ring-slate-200/70 backdrop-blur-2xl sm:p-8">
              <h1 data-auth-page-title="true" className="mb-6 break-words py-1 text-[2rem] font-semibold leading-[1.18] tracking-[-0.035em] text-slate-950 [overflow-wrap:anywhere] sm:text-[2.25rem]">{title}</h1>
              {children}
            </div>
            {footer && <div className="mt-5 text-center text-xs font-medium text-slate-500">{footer}</div>}
          </motion.div>
        </section>
      </div>
    </main>
  );
};
