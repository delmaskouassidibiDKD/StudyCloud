import React from 'react';

const AI_CREDITS_3D_DATA_URI = 'data:image/jpeg;base64,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';
const MY_SUBSCRIPTIONS_3D_DATA_URI = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAQCAwMDAgQDAwMEBAQEBQkGBQUFBQsICAYJDQsNDQ0LDAwOEBQRDg8TDwwMEhgSExUWFxcXDhEZGxkWGhQWFxb/2wBDAQQEBAUFBQoGBgoWDwwPFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhb/wAARCADAAMADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDl1z/kVIpPbH5Uxcg8+lSp71/SV9T8segozj/61Bz/AJFPA5oIq9SLkTE+35VDJnPQflU0nSoZKlspFeUnHIH5VC5PPT8qmm6VC/es2zWJBIT7flUEh54x+VTy1Xk71m3oaxK0zHJ6flVaUnrx+VWph+tVZRWEmbwK0x47flVdyenFWJOlV5KxkzdEEh57flVeQnB/wqxLVeTpWMmbRK03Sq0h69Ksz9/pVaSsJM6YEMp4qvKanm6VXl6VhM2iRSGoX6YqV+9Qv1rmkzVEUhqF+9SvUT9a55Mpbn0Sp5/KpFPFQKfm/CpUavuL6nxjROpxTXbnFM3ChmGKrmIsDnioHOadI3FRSHA96lsuKIpDUL09zUTnis5M1SIpTmoJO9TSH1qvIeDWbZrEgmOarTVYlPNVpjk1i2bRWpXmNV5anm68VBLWUjdEEvWq8nQ1PN7VXkrCRtErTVWkqzNzVaTgVhI6YEM3Sq8p4qaU1BJ0rCZvEhfpULck1NJULGuaTNERyVA9TORmoX5Nc8tylufQW45p4ftVbeM04Oe1fb3PkLFkMaN1Vw/1oZ/Si5PKSO9RO3fNNZqazVLZSQjtkVG5oZsVFI3vUt3LSGysTxUEpp7nioJG5rNs1SIpCcZqvIfWppW5qvIe9ZM2iiFzVeToamkPeoJDWUjZEMvFVpTU8h96rynLYXk+g5Nc82krs3hcrzHmq8hrZtfDniO/hM9l4f1W5jUZLw2UjqB9QDWNNlJGRgVZSVZSMFT3BHauZVac/gkn6M6VGUd0QTHmq8h5qaQ1BJ1rKRrEikPNQtUshqJutc82aIik61C5qWTioZOprnkUj3gsN30pQ3FV9/NKH96+zufKWLIc+poLn1quJDnr+tKX96LhYlLU1m461EZM96Yz80rsFEe7VC7UjuAMk8e5q1pOj6zrEoTStJvbwnp5FuzD8wMVFSrGC5pOy8zSEG3ZIou9QytgYr0XQfgt491NlMthb2CN/FdTDcP+Ark13Hh79moMVfXPEbt6x2kQQfmcn9BXiYniHLaG9VN+Wv5HoUsuxM9o29dD55c+ppIILm8k8qzt5rhz/DDGXP6V9i+GvgV8O9M2vJpJvpF/iupC/wCh4/Su80XQNB0qNU07SLO3VenlwgV8/ieM6Mf4NJv1dv8AM9Olk038creh8T+G/hL8Q9fINj4aukRuj3H7sfrzXoHhj9lnxTeMr65rVlp6HqkQMjD+lfVquAMDgDtSmSvn8TxXmNXSDUV5L/O56FLKsPH4tTxfwv8AsveANP2yatcX+qSDqHk2IfwFeh+HPhr4A0FV/szwnpiMvR5IBI35tmukMvvTHlrwa+NxWId6tRv1Z306FOn8EUiZWSGHyolWOMDASNQoH4Cvjv8A4KEeC9P0XxTpPi3T4EhbW/NgvQi4EksYVlc/7RViCe+0V9cvNXgH/BRC1+0/CLTL7GTZazGc+gkidf5gV3ZDVdLMKdno9H8zLGRUqL8j41kPNQv71JJ0qGQ1+lSPERE/Wom6U9z1xUbk4rnmzSxE/WonPNSOahfr+Fc8mNHthfnjilDn1qsX5o8z6V9i2fNpFrf60b+ariSjzPelzBYsxh5ZViiQu7kKiqMlieABXpPwq+GaazLLP4ijuY4IW2GOOXyyW9M4J/KsL9nK3tr742+H7a62lDO7KD3dYnK/qBX0G220uJrdVCbZpMgeu418jxFmmJpV44ejLlVrtrfe1vLY9fLsJTnB1Jq+tir4b8DeDNHKtZ+HrHevSWZPOf8AN8111qY40CIqhR0UDAH4VhQ3HTnFXbe496+LrudR81STb823+Z7VNKOkVY3oJePpVmKbpzWJDcZxzVqKf3rhnE6YvQ2Fl96kEvvWWk/vUqz+9c0kbJmh5vvQZaoef70hnz3rEoutN71G8tU2nHrUMlx70rDuXJZvevJf204Pt/7PerkDJtXt7ge22YA/o1ejS3GO9cX8fIf7U+DHiWyHzGTS5yo91XeP/Qa6sDP2eKpy7NfmZVfepteR8FOcmoZTinlsqGHQioZDmv1STPBSGN1qJzT2PFQua5pMuwxzULHmpJDxULHmueTsUj2FnG78KN4NVy3OM0b/AHr67mPA5SzuFGRjrVffRu96Vxcp1Pwj1MaT8VfDmolsCDVIdx/2WYKf0Y19P+Nf9F8V3sfZpA4/4EAf6mvjhLhreVLiNvnhYSL9Qcj+VfXXjq9S8utP1RGBW/0+KUEd/wDIIr4ziaKWKoz7pr7mn+p7OWa0px7NMILgHvVuC56c1z1vcAyRx5JaRwiADJJJwBXb6b4ctVYfaLqSQ9wgCivjsbjsPhtKsrNnsUMPUq/CitBc8jmrUVz2zW1BpujRo0CWfmORgnOWXPQ5zxXF/aDHIyMfmQkH6g1wUMdSxTfJ07nRPDzpW5up0SXQ9aet171gJd+9PW74605Djsb32n3pDc+9Yn2v3pUu4l+aWQKo9TWDHdLc2DOT0qGaf1zXKeKPiXouhoYoBHNMOuTmsbw5491fxRdP/ZtnG8MRxLKwCRR+xY9/YZNJuyuzOVWKV2d1Lc9eayfFLi68O3tq3ImheMj2ZCv9a1bLSb+/sfPtbW4um7tGFiiB/wB+Qj9BWH4ksPEFjp87vo6zKBki0v4Z5FA77AQT+GazWJpxkncwnj8Ot3p6O35HwJIpiJibgxnafqOKic1qeNbKew8U6hBPBLCDdStGJEKkqXJBANZDHiv1mFaNWmqkXdNHmRcZK8XdDXP5VC5/CnOevNRO1ZyZSQyQ1Ex605z71G1c85FJHqe8+tAkNVy/egPX1fOeNylkSn1pfNqtv4o38U+cXKTlweK+j/BurPqvwm8O3Mj5e2g+zsc+gA/9kNfNJkGK9j+Bmq+f8P5tMY/Na3DOnsM//Z18rxVC9ClVX2Zfg01/kenlllOUX1X5M6/V7+S2SG5jJzBPHJx7MM16XFfrFeQSouN0hQtu5IIOM/iBXkmrB7jT5okwXdCFz64rpdE16MabbS3Sut0I1Dx/e2MBg4NflnEOHqVp05Uot7rQ+ny+cYKSk7HpMN+Y712LSfvkUjaO4yD+hFcjq04j1e5QZAEpIBPPPP8AWqP/AAlE3IhhUD1c5/Ss5ruSWVpZHLO5yxrHKsHiKEpSqKyaKxVWnNJR1NyK6/2qkW575rEjn7ZqUXGO9erJnMjVmvViiaR2wqjJryz4k+PpYPNEUpUDIUA10vjPUPK0tlVsbuOtfOHxM1dptUkhRztBx9KzSuzCrJ3sXhrNzrerMXncQod0zg84z0Hua92+EWu2tjpiajPCqWFgMR2Y4WWU9F9/Vj1PTIGc+EeCtIkj8NLqR6O6swP8RZsKPyBNd/LqCx2sFpD8sVumMDux+8x9814OPxcnV5Vsj4DOc0rLF8qfux2835novir4ha5rdwzy3rxQ9EgiO1EHoAKxYdYvWnHk3ExkzxtYkmuQ+3N2NeufspeDZPEniv8A4SG9QnTdIcEAjiafqo+i9T7kVw01OtUUUzy8J9ZzHFxpRk7vr2Xc8u+L+hxeKtOeO/t2t9SiG5ZXjKMT2JB5+vqK+cL6KW2u5LadSksLlJFPZgcGvvX9t7xLpd3r+laBDtk1OwjeW8lAGY0kA2RE/gWx2yPWvjf4+2cdt44ivolAXVtOgu3wOPM+aN/zaMn8a+54Rx06WJqYFyvG115Pr/XkfQZdfDY+rglPmS1v59f+D5nEyN+dROcd6Vm71G5/WvvJSPoLDXNRMePwpzGo3J5rmnI0SPRjIPel8yqxc569qA9fU855fKWhJR5tVi4pPM9qOYOUs+ZXoXwBuz9s1C1z95NwH4H/AOJFeab67D4F3Rj8drB/z3hIx64IP8s15OeR9pl9Rdtfudzowvu1os9gE3PWpYpjmswybXKHqpwaljm96/N3M96xqpLjHNTxz+9ZUcvvU0c3vWTkWomrHN71IZ+OazFmwKVp+OTWUmUc78Vr94NL3q3TNfPGvztPqMshPLGvfviRCbvR5FHJA4rwHVraSO6fcpyDgilFHNVXvHe+EdXik+HlraFl85NTOV77EiAX8Mu1dp8IdJtvFnxJ0vw3eXJgjv5G3uGAYKqljjPf0rxHw/PJYahbyzSJ5dzvCqHBIwQMkdufXrXYXf2mR7e9sL2eyvLSQS21zA5V4nHQg/0r5Sq0sR+9Wl9T85xdGnDMIvEK8b6n038Tv2eNU06/tpPBVzNqtlNKsU0VztWe2JON5xgPGO5HI9D1r127udD+C3wVeYKJYdMhARCcNe3T9F+rNyfQA+leQfs2ftN2moCPwr8UJ4dL1SFMQay3y216B/fP8D/oa479rD4nweN/F8WkaHdibw/o+fJlTIW7nYfPKPVQPlX8T3rvlOhh6bqUt2fSVJZdleHqYrB/FPRLt/kurOB1vWb7Wtcu9Y1OczXl/O09xIf4mY5P4DoB2AFed/H+cNrmiW5PzQaLGWHpvmlcfoR+ddTLMI4yzuEUdWP8I7mvL/H+uDxD4tvdVRDHDKyx26H+CJFCIP8AvlR+JNerwZRnPHTr9Ir8WfP8PUpTxM6z7b+bMdzUbHilY1Gx4r9JlI+zSEc8VExxn1pXNRscnmsHI0R3m/mjear7+nWgv719NzanBylgPQZCfWq/mCjzPejnYcpYL4rq/gQ6H4w+H4pWAS5vBbn/AIGCo/UiuLL88Vb0HUn0rxBp+qxk7rC8iuBjr8jhv6VhiY+1ozh3TX4FQ0kmfQ/ieJrLxNqFm3BguXTH/Aqrxy+9bfxm+zS+PZ9U0+RZbLWIYr62lQ5WRXQcg/UGubh3swVQST2Ffleq0Z76L6S+9TJL71d0nwl4gvLb7WbE21oBlrq7YQwqPUu2BVDWvEnwq8MBhrPjT+17pOtl4fh+0HPoZjiMfmaulQq1nanFv0CU4x3ZOkjVsaH4c17WATY6dPIg5aQrhQPUk8V5lrP7RcdirQ+B/Amm2HZb3V3N5P8AUINsY/8AHq808c/Erx54vJXxF4r1K6gY8Wqy+Tbr7CKPC4/CvWocP4qprUaivvf4f5nPLF01tqe+eN7zwX4bV4PEvjXTEuVGGstPJvLgH0IjyAf94ivFvE3i/wAHR6g02heFZb9ieJ9anIQ+4giIH/fTmuAJVRhQAPYU0tXs0MiwlLWd5Pz2+5HLPEzl5F/xJq9zrWqRaheR2sZgUIkVnbJAipknaoUDnk8nJ966Tw9qgktkSVxgj5H7P/8AX9RXEu9Ps764s5C0LDDfeR13I31H9eteHn3CtPFy9rhbRl26P/I8jHYCOKWu56QPLYhiFPpT3mjRcs4AHfNcOPFDLDj+zY1b1juHC/8AfJz/ADrJ1HVb27Y75mCH+FTx9K+VpcH5lKpy1LRXe9/wR4scgrOVpSVjd8b+JPPjfT7N8oeJXHcf3RXIk4pWIxTHb3r9Ay7L6OXYdUaXzfVvufSYPCU8NT9nTX/BEY1G55xmh2ycUxiO1dUpHYkIx/8ArUwmlY1G7dqwcrlpHZlxSbh61AXGaN4r6PnONIsbgKNwqDdRuxS5w5Sbdik3ioS3vSb6OcOU7fwH8Stb8M2kenS29prOlRMWisb8MRCT18t1IZM+nI9q6LVPj54hWLZ4Y8O6B4efHNxFbm6n/BpSQv4LXkxekL88VwTwGEnP2kqabNlVqJWT0Nrxh4r8TeK7nz/E2v6jqr5yBd3DOi/RPuj8AKxyQBgVGze9NZvyrpXLBWirIjfcezCmM3bNMLe9ML1LmFiRmwc0xmphamM9Q5BYezVEzc8U1mprNzWUpDFc80xjSM1MkesZTLUQZuajZsnFIzZpjNzgZrFstCsfT/8AXTGPagtTGIrGUikgY8VHnJ5oY569BTWbms2yjqi1G6q+/wB8Ub/Q17fOzksWNwpS4qvv96N5p84WJ99IXA71Bv8AejdzS5wsTFxSGQVCXGKaXzS5h2Ji5prNnvUW+kLVLmBITimM/NMLUhNQ5hYczUzd/kU0sKaWJ71m5lKI5iB3prN+FMLCmM2azcy0hzPxxTGORzSbsdKYxrJyGkKTTCaRm4prGspSLSsDGmMc8mlY+tMY1m5DBmpjHI9qCaQc81m2PY6Ddz/9egNURP4UKT6ivW5zn5SUtRuFR5Pt+dJk/wCTT5xcpIWo3VHk+g/OlyfWlzhyjyxpM0wk+tIT70ue47IeTSFhUZOKQt70nMfKSFvamM3qfyphJ/8A100n3FQ5MaQ8t6U3dmmE/SkJPt+dQ5DHFhTC1ISPY00/UVnKQ0hSfemk+tISaYazbLFY00kChjTKzbBIGNNJx1oNJ3zUtlBjuaCQKCeKQipCx//Z';

/**
 * Logo 3D "Crédits IA" — intégré en dur (zéro chargement réseau).
 */
export const AiCredits3DIcon: React.FC<{ className?: string }> = ({ className = 'w-[86%] h-[86%]' }) => (
  <div className={`${className} rounded-[22%] overflow-hidden bg-[#0b1033] border border-white/25 dark:border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)]`}>
    <img
      src={AI_CREDITS_3D_DATA_URI}
      alt="Crédits IA"
      decoding="sync"
      loading="eager"
      className="w-full h-full object-cover"
      draggable={false}
    />
  </div>
);

/**
 * Logo 3D "Mes abonnements" — intégré en dur (zéro chargement réseau).
 */
export const MySubscriptions3DIcon: React.FC<{ className?: string }> = ({ className = 'w-[86%] h-[86%]' }) => (
  <div className={`${className} rounded-[22%] overflow-hidden bg-[#1239a8] border border-white/25 dark:border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)]`}>
    <img
      src={MY_SUBSCRIPTIONS_3D_DATA_URI}
      alt="Mes abonnements"
      decoding="sync"
      loading="eager"
      className="w-full h-full object-cover"
      draggable={false}
    />
  </div>
);

/**
 * Logo 3D "Abonnements" — SVG vectoriel en dur (zéro chargement réseau).
 */
export const Subscriptions3DIcon: React.FC<{ className?: string }> = ({ className = 'w-[86%] h-[86%]' }) => (
  <div className={`${className} rounded-[22%] overflow-hidden bg-[#062226] border border-white/25 dark:border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)]`}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-full h-full" fill="none">
      <defs>
        <radialGradient id="scSubBgSpot" cx="28%" cy="22%" r="85%" fx="24%" fy="18%">
          <stop offset="0%" stopColor="#147a6c" />
          <stop offset="38%" stopColor="#0b4642" />
          <stop offset="76%" stopColor="#062226" />
          <stop offset="100%" stopColor="#031217" />
        </radialGradient>
        <radialGradient id="scSubGoldAura" cx="50%" cy="48%" r="36%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.34" />
          <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="scSubFloorShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.62" />
          <stop offset="65%" stopColor="#000000" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="scSubGoldLit" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="22%" stopColor="#fde68a" />
          <stop offset="58%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="scSubGoldShade" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="45%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="scSubGoldDeep" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
        <linearGradient id="scSubGoldBand" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="18%" stopColor="#f59e0b" />
          <stop offset="42%" stopColor="#fef3c7" />
          <stop offset="65%" stopColor="#fbbf24" />
          <stop offset="86%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <linearGradient id="scSubGoldRimTop" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.25" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#fde68a" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="scSubGlassRing" x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#2dd4bf" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="scSubGemLight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ecfeff" />
          <stop offset="35%" stopColor="#5eead4" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id="scSubGemDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#115e59" />
        </linearGradient>
        <radialGradient id="scSubOrbGold" cx="34%" cy="30%" r="68%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="28%" stopColor="#fef08a" />
          <stop offset="68%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>
      </defs>

      <rect width="512" height="512" fill="url(#scSubBgSpot)" />
      <circle cx="256" cy="248" r="185" fill="url(#scSubGoldAura)" />
      <ellipse cx="256" cy="404" rx="134" ry="26" fill="url(#scSubFloorShadow)" />

      <g opacity="0.92">
        <ellipse cx="256" cy="370" rx="146" ry="30" fill="url(#scSubGlassRing)" stroke="#99f6e4" strokeOpacity="0.38" strokeWidth="2.5" />
        <ellipse cx="256" cy="368" rx="116" ry="18" fill="#041b1b" fillOpacity="0.58" />
      </g>

      <g>
        <polygon points="154,312 184,188 232,268" fill="url(#scSubGoldDeep)" />
        <polygon points="358,312 328,188 280,268" fill="url(#scSubGoldDeep)" />

        <polygon points="116,320 96,178 164,250 156,320" fill="url(#scSubGoldLit)" />
        <polygon points="164,250 192,262 178,320 156,320" fill="url(#scSubGoldShade)" />

        <polygon points="396,320 416,178 348,250 356,320" fill="url(#scSubGoldShade)" />
        <polygon points="348,250 320,262 334,320 356,320" fill="url(#scSubGoldLit)" />

        <polygon points="154,322 256,134 256,322" fill="url(#scSubGoldLit)" />
        <polygon points="256,134 358,322 256,322" fill="url(#scSubGoldShade)" />
        <polygon points="256,134 242,322 256,322" fill="#ffffff" fillOpacity="0.22" />
        <line x1="256" y1="138" x2="256" y2="316" stroke="#fffbeb" strokeOpacity="0.6" strokeWidth="2.2" />

        <line x1="99" y1="181" x2="119" y2="318" stroke="#fef9c3" strokeOpacity="0.65" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="254" y1="138" x2="164" y2="250" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />

        <rect x="114" y="314" width="284" height="44" rx="22" fill="url(#scSubGoldBand)" />
        <rect x="122" y="317" width="268" height="8" rx="4" fill="url(#scSubGoldRimTop)" />
        <path d="M 134 355 H 378 C 386 355 393 350 396 344 C 392 353 384 358 374 358 H 138 C 128 358 120 353 116 344 C 119 350 126 355 134 355 Z" fill="#451a03" fillOpacity="0.55" />

        <circle cx="176" cy="336" r="7.5" fill="url(#scSubOrbGold)" />
        <circle cx="256" cy="336" r="9.5" fill="url(#scSubGemLight)" stroke="#fef3c7" strokeWidth="2" />
        <circle cx="336" cy="336" r="7.5" fill="url(#scSubOrbGold)" />

        <g>
          <polygon points="256,214 282,256 256,296 230,256" fill="#0d9488" />
          <polygon points="256,214 256,256 230,256" fill="url(#scSubGemLight)" />
          <polygon points="256,214 282,256 256,256" fill="#99f6e4" />
          <polygon points="256,256 282,256 256,296" fill="url(#scSubGemDark)" />
          <polygon points="230,256 256,256 256,296" fill="#14b8a6" />
          <polygon points="256,222 269,254 256,254" fill="#ffffff" fillOpacity="0.55" />
        </g>

        <circle cx="256" cy="126" r="19" fill="url(#scSubOrbGold)" />
        <circle cx="96" cy="168" r="15" fill="url(#scSubOrbGold)" />
        <circle cx="416" cy="168" r="15" fill="url(#scSubOrbGold)" />
      </g>

      <path d="M 398 92 L 405 111 L 424 118 L 405 125 L 398 144 L 391 125 L 372 118 L 391 111 Z" fill="url(#scSubGoldLit)" />
      <path d="M 102 384 L 107 397 L 120 402 L 107 407 L 102 420 L 97 407 L 84 402 L 97 397 Z" fill="url(#scSubGoldLit)" opacity="0.9" />
    </svg>
  </div>
);

/**
 * Logo 3D "NoteFlow" — Objet 3D flottant sans fond blanc (exactement comme DKD store & Menu de création).
 * Chapeau de diplômé bleu saphir 3D + livre ouvert 3D à page dorée + barres 3D multicolores + flèche dorée lumineuse.
 * 100 % en dur (zéro chargement réseau), pleine taille (w-full h-full) identique aux autres apps sur mobile & PC.
 */
export const NoteFlow3DIcon: React.FC<{ className?: string }> = ({ className = 'w-full h-full' }) => (
  <div className={`relative flex items-center justify-center ${className}`}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className="w-full h-full filter drop-shadow-[0_8px_16px_rgba(15,23,42,0.42)]"
      fill="none"
    >
      <defs>
        {/* Halo doux bleu/or derrière l'objet 3D */}
        <radialGradient id="nfAura3D" cx="50%" cy="52%" r="46%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.38" />
          <stop offset="65%" stopColor="#2563EB" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </radialGradient>

        {/* Chapeau 3D Bleu Saphir / Royal */}
        <linearGradient id="nfCapTop3D" x1="14" y1="6" x2="86" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="42%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id="nfCapRim3D" x1="14" y1="22" x2="86" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="50%" stopColor="#172554" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="nfCapBase3D" x1="30" y1="28" x2="70" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>

        {/* Couverture de livre 3D Bleu Nuit / Saphir */}
        <linearGradient id="nfCover3D" x1="6" y1="54" x2="94" y2="94" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="52%" stopColor="#0F295C" />
          <stop offset="100%" stopColor="#071530" />
        </linearGradient>

        {/* Page gauche dorée-ambre lumineuse 3D */}
        <linearGradient id="nfGoldPage3D" x1="12" y1="44" x2="50" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="35%" stopColor="#FBBF24" />
          <stop offset="78%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#C2410C" />
        </linearGradient>

        {/* Flèche & pompon 3D Or Brillant */}
        <linearGradient id="nfGoldBright3D" x1="45" y1="26" x2="92" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="38%" stopColor="#FACC15" />
          <stop offset="76%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Barres 3D ascendantes (Cyan, Émeraude, Royal, Violet) */}
        <linearGradient id="nfBar1Front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="nfBar2Front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="nfBar3Front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="nfBar4Front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>

      {/* Ombre portée douce sous l'objet 3D */}
      <ellipse cx="50" cy="92" rx="38" ry="5.5" fill="#000000" fillOpacity="0.32" />
      <circle cx="50" cy="52" r="44" fill="url(#nfAura3D)" />

      {/* ================================================================ */}
      {/* 1. CHAPEAU DE DIPLÔMÉ 3D (BLEU SAPHIR + POMPON OR)               */}
      {/* ================================================================ */}
      {/* Calotte 3D cylindrique */}
      <path
        d="M 30 28 L 30 42 C 39 36.5 61 36.5 70 42 L 70 28 L 50 37 Z"
        fill="url(#nfCapBase3D)"
        stroke="#0F172A"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Reflet courbé sur la calotte */}
      <path d="M 34 33 Q 50 28 66 33" stroke="#93C5FD" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />

      {/* Tranche / épaisseur 3D du plateau du chapeau */}
      <path
        d="M 11 22.5 L 50 39 L 89 22.5 L 89 25.5 L 50 42 L 11 25.5 Z"
        fill="url(#nfCapRim3D)"
      />
      {/* Face supérieure biseautée 3D du chapeau */}
      <path
        d="M 50 6 L 89 22.5 L 50 39 L 11 22.5 Z"
        fill="url(#nfCapTop3D)"
        stroke="#0F172A"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Reflet vitré diagonal sur le haut du chapeau */}
      <path
        d="M 50 8.2 L 82 22.2 L 50 27.5 L 18 22.2 Z"
        fill="#FFFFFF"
        fillOpacity="0.22"
      />
      {/* Bouton doré au sommet du chapeau */}
      <ellipse cx="50" cy="21" rx="4.2" ry="2.5" fill="url(#nfGoldBright3D)" stroke="#78350F" strokeWidth="0.9" />

      {/* Cordon & pompon 3D doré suspendu à gauche */}
      <path d="M 50 21 C 34 21 20 24 19 31 L 19 36" stroke="#FBBF24" strokeWidth="2.3" strokeLinecap="round" fill="none" />
      <circle cx="19" cy="36.5" r="2.7" fill="url(#nfGoldBright3D)" stroke="#78350F" strokeWidth="0.8" />
      <path
        d="M 16.8 38.5 L 21.2 38.5 L 23.4 48.5 C 21 49.5 17 49.5 14.6 48.5 Z"
        fill="url(#nfGoldBright3D)"
        stroke="#78350F"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />

      {/* ================================================================ */}
      {/* 2. LIVRE OUVERT 3D (COUVERTURE SAPHIR + PAGE DORÉE + BARRES 3D)  */}
      {/* ================================================================ */}
      {/* Couverture rigide 3D (épaisseur externe + pointe centrale) */}
      <path
        d="M 8 53 L 8 78.5 C 24 79 39 84 50 92.5 C 61 84 76 79 92 78.5 L 92 72 C 76 72.5 61 77.5 50 86 C 39 77.5 24 72.5 13 72 L 13 53 Z"
        fill="url(#nfCover3D)"
        stroke="#020617"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Tranche blanche épaisse des pages sous la page dorée */}
      <path
        d="M 13 71.5 C 25 72.2 38 76.2 48.5 83.8 L 48.5 86.2 C 38 78.5 25 74.5 13 73.8 Z"
        fill="#E2E8F0"
      />
      <path
        d="M 87 71.5 C 75 72.2 62 76.2 51.5 83.8 L 51.5 86.2 C 62 78.5 75 74.5 87 73.8 Z"
        fill="#CBD5E1"
      />

      {/* Page gauche 3D dorée-ambre brillante */}
      <path
        d="M 15.5 49 C 28 50 39.5 54 47.8 61.5 L 47.8 82.8 C 39.2 75.5 28 71.5 15.5 70.6 Z"
        fill="url(#nfGoldPage3D)"
        stroke="#92400E"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Reflet lumineux sur la page dorée */}
      <path
        d="M 17 50.8 C 28 51.6 38 55 46 61.5 L 46 66 C 38 60 28 56.8 17 56 Z"
        fill="#FFFFFF"
        fillOpacity="0.28"
      />
      {/* 3 lignes de notes nettes sur la page dorée */}
      <path d="M 20.5 56.2 Q 31.5 57.5 42.2 62.2" stroke="#FFFBEB" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M 20.5 61.6 Q 31.5 62.9 42.2 67.6" stroke="#FFFBEB" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M 20.5 67.0 Q 31.5 68.3 42.2 73.0" stroke="#FFFBEB" strokeWidth="2.3" strokeLinecap="round" />

      {/* ================================================================ */}
      {/* 3. BARRES DE PROGRESSION 3D (PRISMES AVEC FACE + TRANCHE LATÉRALE)*/}
      {/* ================================================================ */}
      {/* Barre 1 (Cyan 3D) */}
      <polygon points="52,63 57.5,63 57.5,81 52,83.5" fill="url(#nfBar1Front)" stroke="#0C4A6E" strokeWidth="0.8" />
      <polygon points="57.5,63 59.8,61.5 59.8,79.5 57.5,81" fill="#0369A1" />

      {/* Barre 2 (Émeraude 3D) */}
      <polygon points="61.5,57.5 68,57.5 68,76.8 61.5,79.4" fill="url(#nfBar2Front)" stroke="#064E3B" strokeWidth="0.8" />
      <polygon points="68,57.5 70.5,55.8 70.5,75.2 68,76.8" fill="#047857" />

      {/* Barre 3 (Bleu Royal 3D) */}
      <polygon points="72,51 78.5,51 78.5,73.5 72,75.6" fill="url(#nfBar3Front)" stroke="#1E3A8A" strokeWidth="0.8" />
      <polygon points="78.5,51 81,49.2 81,72 78.5,73.5" fill="#1E40AF" />

      {/* Barre 4 (Violet Indigo 3D — plus haute) */}
      <polygon points="82.5,43.5 89,43.5 89,71.2 82.5,72.6" fill="url(#nfBar4Front)" stroke="#3B0764" strokeWidth="0.8" />
      <polygon points="89,43.5 91.5,41.8 91.5,69.8 89,71.2" fill="#4C1D95" />

      {/* ================================================================ */}
      {/* 4. FLÈCHE DE CROISSANCE 3D DORÉE + ÉTINCELLE                     */}
      {/* ================================================================ */}
      {/* Ombre/épaisseur 3D sous la flèche */}
      <path
        d="M 48.5 57.5 L 60.5 47.2 L 65.2 51.5 L 82.8 34.5"
        stroke="#92400E"
        strokeWidth="5.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Corps brillant 3D de la flèche */}
      <path
        d="M 48.5 56 L 60.5 45.7 L 65.2 50 L 82.8 33"
        stroke="url(#nfGoldBright3D)"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pointe 3D de la flèche */}
      <polygon
        points="76,30.2 89.2,26.8 85.8,40"
        fill="url(#nfGoldBright3D)"
        stroke="#92400E"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {/* Éclat d'étoile dorée en haut à droite */}
      <path
        d="M 88 12 C 88 15.2 89.8 17 93 17 C 89.8 17 88 18.8 88 22 C 88 18.8 86.2 17 83 17 C 86.2 17 88 15.2 88 12 Z"
        fill="#FEF08A"
      />
    </svg>
  </div>
);
