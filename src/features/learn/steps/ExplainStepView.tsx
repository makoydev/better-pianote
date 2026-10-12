import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Callout } from '../../../components/ui/Callout'
import { RichText } from '../../../components/ui/RichText'
import { InStep, useShortScreen } from '../../../components/widgets/fit'
import { WidgetView } from '../../../components/widgets/WidgetView'
import type { ExplainStep, WidgetStep } from '../../../content/types'
import { VisualBlock } from '../VisualBlock'
import { besideText } from '../visual'

export function ExplainStepView({ step }: { step: ExplainStep }) {
  const beside = besideText(step.visual)
  return (
    <StepFrame title={step.title} body={step.body} tip={step.tip} guitar={step.guitar} beside={beside}>
      {step.visual && <VisualBlock v={step.visual} fit center={beside} />}
    </StepFrame>
  )
}

export function WidgetStepView({ step }: { step: WidgetStep }) {
  return (
    <StepFrame title={step.title} body={step.body} tip={step.tip} guitar={step.guitar}>
      <InStep value>
        <WidgetView widget={step.widget} />
      </InStep>
    </StepFrame>
  )
}

/**
 * Title, text and side notes, with the picture filling the space that's left, so the whole of it stays on screen
 * (keyboards shrink to fit). On a wide screen the side notes sit beside the text, and a narrow picture beside the
 * text instead of under it.
 */
function StepFrame({
  title,
  body,
  tip,
  guitar,
  beside = false,
  children,
}: {
  title: string
  body?: string
  tip?: string
  guitar?: string
  beside?: boolean
  children?: ReactNode
}) {
  // Short screens (a 13" MacBook, an iPad in landscape) get smaller type, leaving the picture more room.
  const short = useShortScreen()
  const notes = (tip || guitar) && (
    <>
      {guitar && <Callout kind="guitar" text={guitar} />}
      {tip && <Callout kind="tip" text={tip} />}
    </>
  )
  const text = (
    <div className="max-w-3xl">
      <h2
        tabIndex={-1}
        data-step-heading
        className={`font-display text-3xl font-bold leading-tight outline-none ${short ? 'sm:text-[2.1rem]' : 'sm:text-[2.6rem]'}`}
      >
        {title}
      </h2>
      {body && <RichText text={body} className={`leading-relaxed text-ink-soft ${short ? 'mt-3 text-lg' : 'mt-4 text-[1.2rem]'}`} />}
    </div>
  )
  const picture = children && (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="flex flex-1 flex-col">
      {children}
    </motion.div>
  )
  // Below lg the notes come after the picture, as before; at lg they move up beside (or under) the text.
  const notesAfter = notes && <div className="grid gap-3 md:grid-cols-2 lg:hidden">{notes}</div>
  const gap = short ? 'gap-4' : 'gap-6'

  if (beside) {
    return (
      <div className={`mx-auto flex w-full max-w-6xl flex-1 flex-col ${gap} lg:grid lg:grid-cols-2 lg:gap-x-10`}>
        <div className="flex flex-col gap-4 lg:justify-center">
          {text}
          {notes && <div className="hidden gap-3 lg:grid">{notes}</div>}
        </div>
        {picture}
        {notesAfter}
      </div>
    )
  }
  return (
    <div className={`mx-auto flex w-full max-w-6xl flex-1 flex-col ${gap}`}>
      <div className={notes ? 'grid gap-x-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start' : ''}>
        {text}
        {notes && <div className="hidden flex-col gap-3 lg:flex">{notes}</div>}
      </div>
      {picture}
      {notesAfter}
    </div>
  )
}
