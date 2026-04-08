import { motion } from 'motion/react';
import { EmotionType } from '../types';

interface CharacterProps {
  emotion: EmotionType;
}

export const Character = ({ emotion }: CharacterProps) => {
  const getColors = () => {
    switch (emotion) {
      case 'HAPPY': return { body: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)' };
      case 'SAD': return { body: '#60a5fa', glow: 'rgba(96, 165, 250, 0.4)' };
      case 'ANGRY': return { body: '#f87171', glow: 'rgba(248, 113, 113, 0.4)' };
      case 'SURPRISE': return { body: '#a78bfa', glow: 'rgba(167, 139, 250, 0.4)' };
      default: return { body: '#e2e8f0', glow: 'rgba(226, 232, 240, 0.2)' };
    }
  };

  const colors = getColors();

  return (
    <div className="relative flex items-center justify-center">
      {/* Glow Effect */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute w-64 h-64 rounded-full blur-3xl"
        style={{ backgroundColor: colors.glow }}
      />

      {/* Character Body */}
      <motion.div
        layout
        className="relative w-48 h-64 bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-white/20"
        style={{ backgroundColor: colors.body }}
        animate={{
          y: emotion === 'IDLE' ? [0, -10, 0] : 0,
          scale: emotion === 'SURPRISE' ? 1.1 : 1,
          rotate: emotion === 'ANGRY' ? [-1, 1, -1] : 0,
        }}
        transition={{ 
          y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 0.1, repeat: Infinity }
        }}
      >
        {/* Face */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="flex gap-8">
            {/* Eyes */}
            <motion.div 
              animate={{
                height: emotion === 'HAPPY' ? 4 : emotion === 'SURPRISE' ? 24 : 12,
                scaleY: emotion === 'SAD' ? 0.5 : 1
              }}
              className="w-4 bg-slate-900 rounded-full" 
            />
            <motion.div 
              animate={{
                height: emotion === 'HAPPY' ? 4 : emotion === 'SURPRISE' ? 24 : 12,
                scaleY: emotion === 'SAD' ? 0.5 : 1
              }}
              className="w-4 bg-slate-900 rounded-full" 
            />
          </div>
          
          {/* Mouth */}
          <motion.div 
            animate={{
              width: emotion === 'HAPPY' ? 32 : emotion === 'SURPRISE' ? 20 : 24,
              height: emotion === 'HAPPY' ? 16 : emotion === 'SURPRISE' ? 20 : 4,
              borderRadius: emotion === 'HAPPY' ? '0 0 100px 100px' : '100px'
            }}
            className="bg-slate-900" 
          />
        </div>

        {/* Glossy Overlay */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
      </motion.div>
    </div>
  );
};
