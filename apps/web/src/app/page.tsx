"use client";

import { useEffect, useState } from "react";

import RailwayBuilder from "@/components/railway-builder";
import TrainSimulation from "@/components/train-simulation";

export default function Home() {
  const [jsonOutput, setJsonOutput] = useState(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const healthResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/health`);
        const res = await healthResponse.json();
        // handle res
        console.log(res);
      } catch (error) {
        // handle error
        console.log(error);
      }
    };
    fetchHealth();
  }, []);

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
