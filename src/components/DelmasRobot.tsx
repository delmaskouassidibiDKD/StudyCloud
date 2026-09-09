import React, { useEffect, useRef, useState } from 'react';

type Gaze = { x: number; y: number };

const GAZES: Gaze[] = [
  { x: 0, y: 0 },
  { x: 18, y: 0 },
  { x: -18, y: 0 },
  { x: 0, y: -12 },
  { x: 0, y: 16 }, // regarde en bas
  { x: 0, y: 24 }, // regarde bien en bas
  { x: 16, y: 18 }, // regarde en bas à droite
  { x: -16, y: 18 }, // regarde en bas à gauche
  { x: 16, y: -10 },
  { x: -16, y: -10 },
  { x: 8, y: 22 },
  { x: -8, y: 22 },
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

interface DelmasRobotProps {
  className?: string;
  size?: number;
}

export const DelmasRobot: React.FC<DelmasRobotProps> = ({ className = '', size = 42 }) => {
  const [gaze, setGaze] = useState<Gaze>({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let mounted = true;

    const scheduleLook = () => {
      if (!mounted) return;
      const next = GAZES[Math.floor(Math.random() * GAZES.length)];
      setGaze(next);
      const holdFor = randomBetween(800, 2800);
      const t = setTimeout(scheduleLook, holdFor);
      timers.current.push(t);
    };

    const scheduleBlink = () => {
      if (!mounted) return;
      const t1 = setTimeout(() => {
        if (!mounted) return;
        setBlinking(true);
        const t2 = setTimeout(() => {
          setBlinking(false);
          if (Math.random() < 0.35) {
            const t3 = setTimeout(() => {
              setBlinking(true);
              const t4 = setTimeout(() => setBlinking(false), 120);
              timers.current.push(t4);
            }, 180);
            timers.current.push(t3);
          }
          scheduleBlink();
        }, 120);
        timers.current.push(t2);
      }, randomBetween(1500, 4800));
      timers.current.push(t1);
    };

    const startLook = setTimeout(scheduleLook, randomBetween(300, 1000));
    timers.current.push(startLook);
    scheduleBlink();

    return () => {
      mounted = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="relative w-full h-full rounded-full flex items-center justify-center">
        {/* Sphère avec dégradé bleu franc, net et vibrant */}
        <div
          className="relative w-full h-full rounded-full flex items-center justify-center overflow-hidden border-2 border-blue-300/80"
          style={{
            background:
              'radial-gradient(circle at 35% 26%, #93c5fd 0%, #3b82f6 30%, #1d4ed8 66%, #1e3a8a 92%, #0f172a 100%)',
            boxShadow:
              '0 3px 10px rgba(29, 78, 216, 0.4), inset 0 -3px 6px rgba(15, 23, 42, 0.65), inset 0 2px 4px rgba(255, 255, 255, 0.55)',
          }}
        >
          {/* Reflet lumineux net sans flou */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              top: '8%',
              left: '18%',
              width: '38%',
              height: '22%',
              background:
                'radial-gradient(ellipse at 50% 40%, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0) 80%)',
            }}
          />

          {/* Visage net (Yeux + Bouche animés - liberté totale de regard dont vers le bas) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div
              className="flex flex-col items-center justify-center transition-transform duration-500 ease-out"
              style={{
                transform: `translate(${gaze.x * 0.2}px, ${gaze.y * 0.22}px)`,
              }}
            >
              {/* Yeux nets */}
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className="block bg-white rounded-full shadow-[0_0_2px_rgba(255,255,255,0.9)] transition-transform duration-100"
                  style={{
                    width: '6px',
                    height: '10px',
                    transform: blinking ? 'scaleY(0.1)' : 'scaleY(1)',
                  }}
                />
                <span
                  className="block bg-white rounded-full shadow-[0_0_2px_rgba(255,255,255,0.9)] transition-transform duration-100"
                  style={{
                    width: '6px',
                    height: '10px',
                    transform: blinking ? 'scaleY(0.1)' : 'scaleY(1)',
                  }}
                />
              </div>

              {/* Bouche nette */}
              <span
                className="block bg-white rounded-b-full rounded-t-sm shadow-[0_0_2px_rgba(255,255,255,0.9)] mt-1.5"
                style={{
                  width: '11px',
                  height: '3.5px',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
