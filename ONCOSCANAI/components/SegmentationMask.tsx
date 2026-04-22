import React from 'react';

interface Props {
  maskPath?: string;
  fill?: string;
  stroke?: string;
  className?: string;
}

const SegmentationMask: React.FC<Props> = ({ maskPath, fill = 'rgba(239,68,68,0.35)', stroke = 'rgba(239,68,68,0.8)', className }) => {
  if (!maskPath) return null;
  return (
    <svg className={className || 'absolute inset-0 w-full h-full pointer-events-none'} viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d={maskPath} fill={fill} stroke={stroke} strokeWidth={0.5} className="animate-pulse-slow" />
    </svg>
  );
};

export default SegmentationMask;
