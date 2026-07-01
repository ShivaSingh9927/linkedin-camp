"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import React, { useRef } from "react";

export const Skiper19 = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"]
  });

  return (
    <section
      ref={ref}
      className="mx-auto flex h-[350vh] w-full flex-col items-center overflow-hidden bg-[#FAFDEE] px-4 text-[#1F3A4B]"
    >
      <div className="mt-42 relative flex w-fit flex-col items-center justify-center gap-5 text-center pt-24">
        <h1 className="font-display font-jakarta-sans relative z-10 text-9xl font-medium tracking-[-0.08em] lg:text-9xl mix-blend-difference text-white">
          The Stroke <br /> That follows the <br />
          Scroll Progress
        </h1>
        <p className="font-jakarta-sans relative z-10 max-w-2xl text-xl font-medium text-[#1F3A4B]">
          Scroll down to see the effect
        </p>

        <LinePath
          className="absolute -right-[40%] top-0 z-0 opacity-80"
          scrollYProgress={scrollYProgress}
        />
      </div>

      <div className="rounded-4xl font-jakarta-sans w-full translate-y-[150vh] bg-[#1F3A4B] pb-10 text-[#FAFDEE] z-10 relative">
        <h1 className="mt-10 text-center text-[15.5vw] font-medium leading-[0.9] tracking-tighter lg:text-[16.6vw]">
          skiperui.com
        </h1>
        <div className="mt-20 flex w-full flex-col items-start gap-5 px-4 font-medium lg:mt-0 lg:flex-row lg:justify-between">
          <div className="flex w-full items-center justify-between gap-12 uppercase lg:w-fit lg:justify-center">
            <p className="w-fit text-sm">
              punjab, india <br />
              and online
            </p>
            <p className="w-fit text-right text-sm lg:text-left">
              sep 1, 2025 <br /> the Moosa pind
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-12 uppercase lg:w-fit lg:justify-center">
            <p className="w-fit text-sm">
              online <br /> free
            </p>
            <p className="w-fit text-right text-sm lg:text-left">
              open to <br /> all
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const LinePath = ({
  className,
  scrollYProgress,
}: {
  className?: string;
  scrollYProgress: any;
}) => {
  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <svg
      width="1281"
      height="2678"
      viewBox="0 0 1281 2678"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <motion.path
        d="M208.795 9.00609C159.088 -4.89736 103.743 -1.82136 56.6669 19.3402C12.4344 39.2241 -15.918 84.1454 10.3708 132.559C39.4674 186.143 103.58 198.818 161.439 203.22C241.127 209.284 321.464 207.781 401.378 210.021C451.983 211.44 502.73 213.238 552.476 225.293C618.347 241.256 681.42 272.766 749.626 279.79C813.518 286.37 878.694 278.434 940.716 261.802C976.012 252.338 1010.59 240.231 1046.21 231.868C1089.43 221.721 1136.03 215.912 1177.34 233.159C1215.11 248.929 1238.48 285.923 1245.92 325.867C1253.94 368.851 1239.35 413.411 1205.81 441.777C1167.31 474.337 1111.46 478.629 1063.15 464.33C1004.81 447.062 961.436 397.042 949.123 336.568C934.336 263.957 975.295 186.726 1045.02 161.082C1085.39 146.231 1130.63 147.269 1169.58 165.753C1210.37 185.11 1242.06 219.782 1256.76 261.644C1287.64 349.569 1238.74 446.541 1152.05 480.959C1052.88 520.334 934.254 485.474 857.067 407.971C792.81 343.461 773.087 242.502 813.373 162.146C865.176 58.7891 1007.47 28.0932 1106.18 84.1408C1215.71 146.335 1258.94 290.755 1202.47 400.912C1147.23 508.675 1011.66 558.118 898.397 508.859C778.665 456.786 720.007 318.571 767.143 198.817C815.111 76.9443 956.883 14.1568 1078.62 57.5181C1204.64 102.404 1271.74 246.58 1230.93 372.486C1189.17 501.328 1044.22 572.822 915.228 535.14C783.336 496.611 707.411 350.217 741.905 218.423C 87.644 496.837 334.494 518.402 366.466 582.455 367.287C680.013 368.538 771.538 299.456 898.634 292.434C1007.02 286.446 1192.67 309.384 1242.36 382.258C1266.99 418.39 1273.65 443.108 1247.75 474.477C1217.32 511.33 1149.4 511.259 1096.84 466.093C1044.29 420.928 1029.14 380.576 1033.97 324.172C1038.31 273.428 1069.55 228.986 1117.2 216.384C1152.2 207.128 1188.29 213.629 1194.45 245.127C1201.49 281.062 1132.22 280.104 1100.44 272.673C1065.32 264.464 1044.22 234.837 1032.77 201.413C1019.29 162.061 1029.71 131.126 1056.44 100.965C1086.19 67.4032 1143.96 54.5526 1175.78 86.1513C1207.02 117.17 1186.81 143.379 1156.22 166.691C1112.57 199.959 1052.57 186.238 999.784 155.164C957.312 130.164 899.171 63.7054 931.284 26.3214C952.068 2.12513 996.288 3.87363 1007.22 43.58C1018.15 83.2749 1003.56 122.644 975.969 163.376C948.377 204.107 907.272 255.122 913.558 321.045C919.727 385.734 990.968 497.068 1063.84 503.35C1111.46 507.456 1166.79 511.984 1175.68 464.527C1191.52 379.956 1101.26 334.985 1030.29 377.017C971.109 412.064 956.297 483.647 953.797 561.655C947.587 755.413 1197.56 941.828 936.039 1140.66C745.771 1285.32 321.926 950.737 134.536 1202.19C-6.68295 1391.68 -53.4837 1655.38 131.935 1760.5C478.381 1956.91 1124.19 1515 1201.28 1997.83C1273.66 2451.23 100.805 1864.7 303.794 2668.89"
        stroke="#C2F84F"
        strokeWidth="20"
        style={{
          pathLength,
          strokeDashoffset: useTransform(pathLength, (value) => 1 - value),
        }}
      />
    </svg>
  );
};
