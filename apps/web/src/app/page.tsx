"use client";

import { useEffect, useState } from "react";

import RailwayBuilder from "@/components/railway-builder";
import TrainSimulation from "@/components/train-simulation";

export default function Home() {
  const [jsonOutput, setJsonOutput] = useState(null);

  useEffect(() => {
    console.log("JSON Output updated:", jsonOutput);
  }, [jsonOutput]);

  return (
    <div>
      <RailwayBuilder onComputeComplete={setJsonOutput} />
      <TrainSimulation simulationData={jsonOutput} />
    </div>
  );
}
