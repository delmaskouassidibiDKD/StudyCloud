import React from 'react';

interface FileIconBadgeProps {
  fileName?: string;
  size?: number; // width in pixels
  isFolder?: boolean;
}

export const FileIconBadge: React.FC<FileIconBadgeProps> = ({ fileName = '', size = 36, isFolder = false }) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (isFolder) {
    const folderHeight = Math.round(size * 0.85);
    return (
      <div className="relative inline-flex items-center justify-center shrink-0 select-none" style={{ width: size, height: folderHeight }}>
        <svg
          width={size}
          height={folderHeight}
          viewBox="0 0 36 30"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm filter"
        >
          <path
            d="M3 5C3 3.89543 3.89543 3 5 3H13.5L16.5 6.5H31C32.1046 6.5 33 7.39543 33 8.5V25C33 26.1046 32.1046 27 31 27H5C3.89543 27 3 26.1046 3 25V5Z"
            fill="#D97706"
          />
          <path
            d="M3 10.5C3 9.39543 3.89543 8.5 5 8.5H31C32.1046 8.5 33 9.39543 33 10.5V25C33 26.1046 32.1046 27 31 27H5C3.89543 27 3 26.1046 3 25V10.5Z"
            fill="#F59E0B"
          />
          <path
            d="M5 9.5H31C31.5523 9.5 32 9.94772 32 10.5C32 10.05 31.5523 9.7 31 9.7H5C4.44772 9.7 4 10.05 4 10.5C4 9.94772 4.44772 9.5 5 9.5Z"
            fill="#FEF3C7"
            fillOpacity="0.8"
          />
        </svg>
      </div>
    );
  }

  let color = '#57534E'; // default stone
  let label = ext.toUpperCase() || 'FILE';

  if (ext === 'pdf') {
    color = '#EF4444'; // Red
    label = 'PDF';
  } else if (['doc', 'docx'].includes(ext)) {
    color = '#2563EB'; // Blue
    label = 'WORD';
  } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
    color = '#10B981'; // Green
    label = 'EXCEL';
  } else if (['ppt', 'pptx'].includes(ext)) {
    color = '#F97316'; // Orange
    label = 'PPT';
  } else if (['txt', 'md'].includes(ext)) {
    color = '#64748B'; // Slate
    label = 'TXT';
  } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    color = '#A855F7'; // Purple
    label = 'IMG';
  } else if (['zip', 'rar', '7z'].includes(ext)) {
    color = '#EAB308'; // Amber
    label = 'ZIP';
  } else {
    label = ext.length > 5 ? ext.substring(0, 4).toUpperCase() : (ext.toUpperCase() || 'FILE');
  }

  const height = Math.round(size * 1.22);

  return (
    <div className="relative inline-flex items-center justify-center shrink-0 select-none" style={{ width: size, height }}>
      <svg
        width={size}
        height={height}
        viewBox="0 0 36 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm filter"
      >
        {/* Document base with folded top-right corner */}
        <path
          d="M4 2H24L34 12V40C34 41.1046 33.1046 42 32 42H4C2.89543 42 2 41.1046 2 4V4C2 2.89543 2.89543 2 4 2Z"
          fill={color}
        />
        {/* Folded corner highlight */}
        <path d="M24 2V12H34" fill="#ffffff" fillOpacity="0.35" />
        {/* Folded corner shadow */}
        <path d="M24 2L34 12H24Z" fill="#000000" fillOpacity="0.2" />
        
        {/* Text Label */}
        <text
           x="18"
           y="28"
           fill="white"
           fontSize={isFolder ? "6.5" : (label.length > 3 ? "7" : "8.5")}
           fontWeight="900"
           fontFamily="ui-sans-serif, system-ui, sans-serif"
           textAnchor="middle"
           letterSpacing={label.length > 3 ? "-0.5" : "0"}
        >
          {label}
        </text>
      </svg>
    </div>
  );
};


