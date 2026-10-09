import { motion } from 'motion/react'
import { Callout } from '../../../components/ui/Callout'
import { RichText } from '../../../components/ui/RichText'
import { WidgetView } from '../../../components/widgets/WidgetView'
import type { ExplainStep, WidgetStep } from '../../../content/types'
import { VisualBlock } from '../VisualBlock'

export function ExplainStepView({ step }: { step: ExplainStep }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="max-w-3xl">
        <h2 className="font-display text-3xl font-bold leading-tight sm:text-[2.6rem]">{step.title}</h2>
        <RichText text={step.body} className="mt-4 text-[1.2rem] leading-relaxed text-ink-soft" />
      </div>
      {step.visual && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <VisualBlock v={step.visual} />
        </motion.div>
      )}
      {(step.tip || step.guitar) && (
        <div className="grid max-w-4xl gap-3 md:grid-cols-2">
          {step.guitar && <Callout kind="guitar" text={step.guitar} />}
          {step.tip && <Callout kind="tip" text={step.tip} />}
        </div>
      )}
    </div>
  )
}

export function WidgetStepView({ step }: { step: WidgetStep }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="max-w-3xl">
        <h2 className="font-display text-3xl font-bold leading-tight sm:text-[2.6rem]">{step.title}</h2>
        {step.body && <RichText text={step.body} className="mt-4 text-[1.2rem] leading-relaxed text-ink-soft" />}
      </div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
        <WidgetView widget={step.widget} />
      </motion.div>
      {(step.tip || step.guitar) && (
        <div className="grid max-w-4xl gap-3 md:grid-cols-2">
          {step.guitar && <Callout kind="guitar" text={step.guitar} />}
          {step.tip && <Callout kind="tip" text={step.tip} />}
        </div>
      )}
    </div>
  )
}
