import Button, { type ButtonProps } from '@mui/material/Button'
import { synapse } from '../theme'

/** Primary CTA styled to the neon/synaptic aesthetic. */
export default function GlowButton(props: ButtonProps) {
  const { sx, ...rest } = props
  return (
    <Button
      variant="contained"
      {...rest}
      sx={{
        px: 3.5,
        py: 1.2,
        fontWeight: 600,
        letterSpacing: 0.4,
        borderRadius: 2.5,
        textTransform: 'none',
        fontSize: '1rem',
        color: '#031018',
        background: `linear-gradient(120deg, ${synapse.cyan}, #67e8f9)`,
        boxShadow: `0 0 24px rgba(34, 211, 238, 0.45)`,
        transition: 'box-shadow 0.3s ease, transform 0.2s ease',
        '&:hover': {
          background: `linear-gradient(120deg, #67e8f9, ${synapse.cyan})`,
          boxShadow: `0 0 40px rgba(34, 211, 238, 0.7)`,
          transform: 'translateY(-1px)',
        },
        ...sx,
      }}
    />
  )
}
