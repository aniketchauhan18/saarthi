"use client";
/* eslint-disable */


import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Square,
  Train,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import LeftPane from "./left-pane";
import RightPane from "./right-pane";
import { Button } from "./ui/button";
import { instrumentSerif } from "@/lib/fonts";

interface TrainSimulationProps {
  simulationData: any;
}
interface StationPosition {
  id: number;
  name: string;
  x: number;
  y: number;
}

interface Point {
  x: number;
  y: number;
}

interface IsTooCloseParams {
  newPoint: Point;
  existingPoints: Point[];
  minDist: number;
}

interface TrainScheduleSegment {
  entry_time_minutes: number;
  exit_time_minutes: number;
  from_station: number;
  to_station: number;
  from_station_name: string;
  to_station_name: string;
  section_id: number;
  actual_speed_kmh?: number;
}

interface TrainResult {
  train_id: number;
  schedule: TrainScheduleSegment[];
  max_speed_kmh: number;
  delay_minutes?: number;
  start_station_name: string;
  end_station_name: string;
  priority_score: number;
  start_station: number;
  end_station: number;
}

interface TrainPositionMoving {
  x: number;
  y: number;
  moving: true;
  fromStation: string;
  toStation: string;
  progress: number;
  sectionId: number;
  currentSpeed?: number;
}

interface TrainPositionWaiting {
  x: number;
  y: number;
  moving: false;
  atStation: string;
  waiting: true;
}

interface TrainPositionCompleted {
  x: number;
  y: number;
  moving: false;
  atStation: string;
  completed: true;
}

type TrainPosition =
  | TrainPositionMoving
  | TrainPositionWaiting
  | TrainPositionCompleted
  | null;

interface TrainScheduleSegment {
  entry_time_minutes: number;
  exit_time_minutes: number;
  from_station: number;
  to_station: number;
  from_station_name: string;
  to_station_name: string;
  section_id: number;
  actual_speed_kmh?: number;
}

interface TrainResult {
  train_id: number;
  schedule: TrainScheduleSegment[];
  max_speed_kmh: number;
  delay_minutes?: number;
  start_station_name: string;
  end_station_name: string;
  priority_score: number;
  start_station: number;
  end_station: number;
}

interface TrainStatusResult {
  status: "idle" | "waiting" | "completed" | "running";
}

interface TrainScheduleSegment {
  entry_time_minutes: number;
  exit_time_minutes: number;
  from_station: number;
  to_station: number;
  from_station_name: string;
  to_station_name: string;
  section_id: number;
  actual_speed_kmh?: number;
}

interface TrainResult {
  train_id: number;
  schedule: TrainScheduleSegment[];
  max_speed_kmh: number;
  delay_minutes?: number;
  start_station_name: string;
  end_station_name: string;
  priority_score: number;
  start_station: number;
  end_station: number;
}

const TrainSimulation = ({ simulationData }: TrainSimulationProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [leftPaneCollapsed, setLeftPaneCollapsed] = useState(false);
  const [rightPaneCollapsed, setRightPaneCollapsed] = useState(false);


  // Zoom and Pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getStationPositions = () => {
    if (!simulationData?.output?.stations) return [];
    const stations = simulationData.output.stations;
    const stationIds = Object.keys(stations).sort(
      (a, b) => parseInt(a) - parseInt(b),
    );
    const positions: StationPosition[] = [];
    const padding = 50;
    const viewWidth = 1200 - padding * 2;
    const viewHeight = 1000 - padding * 2;
    const startX = padding;
    const startY = padding;
    const minDistance = 80;

    const areCollinear = (
      p1: Point,
      p2: Point,
      p3: Point,
      tolerance: number = 5,
    ): boolean => {
      const area = Math.abs(
        p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y),
      );
      return area < tolerance;
    };

    const isTooClose = ({
      newPoint,
      existingPoints,
      minDist,
    }: IsTooCloseParams): boolean => {
      return existingPoints.some((point) => {
        const distance = Math.sqrt(
          Math.pow(newPoint.x - point.x, 2) + Math.pow(newPoint.y - point.y, 2),
        );
        return distance < minDist;
      });
    };

    const createsCollinearity = (
      newPoint: Point,
      existingPoints: Point[],
    ): boolean => {
      if (existingPoints.length < 2) return false;
      for (let i = 0; i < existingPoints.length; i++) {
        for (let j = i + 1; j < existingPoints.length; j++) {
          if (areCollinear(existingPoints[i], existingPoints[j], newPoint)) {
            return true;
          }
        }
      }
      return false;
    };

    let seed = 12345;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const generateSeededPosition = () => {
      return {
        x: startX + seededRandom() * viewWidth,
        y: startY + seededRandom() * viewHeight,
      };
    };

    stationIds.forEach((id, index) => {
      let attempts = 0;
      let validPosition = null;
      const maxAttempts = 1000;

      while (!validPosition && attempts < maxAttempts) {
        const candidate = generateSeededPosition();
        const tooClose = isTooClose({
          newPoint: candidate,
          existingPoints: positions,
          minDist: minDistance,
        });
        const collinear = createsCollinearity(candidate, positions);

        if (!tooClose && !collinear) {
          validPosition = candidate;
        }
        attempts++;
      }

      if (!validPosition) {
        const angle =
          (index * 2 * Math.PI) / stationIds.length +
          (seededRandom() - 0.5) * 0.5;
        const radius = viewWidth * 0.3 + seededRandom() * (viewWidth * 0.15);
        const centerX = startX + viewWidth / 2;
        const centerY = startY + viewHeight / 2;

        validPosition = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        };

        validPosition.x = Math.max(
          startX,
          Math.min(startX + viewWidth, validPosition.x),
        );
        validPosition.y = Math.max(
          startY,
          Math.min(startY + viewHeight, validPosition.y),
        );
      }

      positions.push({
        id: parseInt(id),
        name: stations[id],
        x: validPosition.x,
        y: validPosition.y,
      });
    });

    for (let i = 0; i < positions.length; i++) {
      for (let j = 0; j < positions.length; j++) {
        for (let k = 0; k < positions.length; k++) {
          if (i !== j && j !== k && i !== k) {
            if (areCollinear(positions[i], positions[j], positions[k], 10)) {
              positions[k].x += (seededRandom() - 0.5) * 20;
              positions[k].y += (seededRandom() - 0.5) * 20;
              positions[k].x = Math.max(
                startX,
                Math.min(startX + viewWidth, positions[k].x),
              );
              positions[k].y = Math.max(
                startY,
                Math.min(startY + viewHeight, positions[k].y),
              );
            }
          }
        }
      }
    }

    return positions;
  };

  const getSectionInfo = () => {
    if (!simulationData?.output?.sections) return [];
    const sections = simulationData.output.sections;
    const stations = getStationPositions();

    return Object.values(sections).map((section) => {
      const sec = section as {
        section_id?: number;
        id?: number;
        from_station: number;
        to_station: number;
        from_station_name: string;
        to_station_name: string;
        distance_km: number;
        max_speed_kmh: number;
      };
      const fromStation = stations.find((s) => s.id === sec.from_station);
      const toStation = stations.find((s) => s.id === sec.to_station);
      const reverseSection = Object.values(sections).find((s) => {
        const rs = s as typeof sec;
        return (
          rs.from_station === sec.to_station &&
          rs.to_station === sec.from_station
        );
      });

      return {
        id: sec.section_id || sec.id,
        from: sec.from_station,
        to: sec.to_station,
        fromName: sec.from_station_name,
        toName: sec.to_station_name,
        distance: sec.distance_km,
        maxSpeed: sec.max_speed_kmh,
        fromPos: fromStation,
        toPos: toStation,
        bidirectional: !!reverseSection,
        reverseId:
          (reverseSection as typeof sec)?.section_id ||
          (reverseSection as typeof sec)?.id,
      };
    });
  };

  const getTrainPositions = () => {
    if (!simulationData?.output?.train_results) return [];
    const stations = getStationPositions();
    const trainResults = simulationData.output.train_results;

    return Object.values(trainResults)
      .map((train) => {
        const t = train as {
          train_id: number;
          schedule: any[];
          max_speed_kmh: number;
          delay_minutes?: number;
          start_station_name: string;
          end_station_name: string;
          priority_score: number;
          start_station: number;
          end_station: number;
        };
        const position = calculateTrainPosition(t, currentTime, stations);
        return {
          id: t.train_id,
          position: position,
          color: getTrainColor(t.train_id),
          status: getTrainStatus(t, currentTime),
          maxSpeed: t.max_speed_kmh,
          currentSpeed: getCurrentSpeed(t, currentTime),
          delay: t.delay_minutes || 0,
          route: `${t.start_station_name} → ${t.end_station_name}`,
          priority: t.priority_score,
        };
      })
      .filter((train) => train.position);
  };

  const calculateTrainPosition = (
    train: TrainResult,
    time: number,
    stations: StationPosition[],
  ): TrainPosition => {
    if (!train.schedule || train.schedule.length === 0) return null;

    for (let segment of train.schedule) {
      if (
        time >= segment.entry_time_minutes &&
        time <= segment.exit_time_minutes
      ) {
        const fromStation = stations.find((s) => s.id === segment.from_station);
        const toStation = stations.find((s) => s.id === segment.to_station);

        if (!fromStation || !toStation) continue;

        const progress =
          (time - segment.entry_time_minutes) /
          (segment.exit_time_minutes - segment.entry_time_minutes);
        return {
          x: fromStation.x + (toStation.x - fromStation.x) * progress,
          y: fromStation.y + (toStation.y - fromStation.y) * progress,
          moving: true,
          fromStation: segment.from_station_name,
          toStation: segment.to_station_name,
          progress: Math.round(progress * 100),
          sectionId: segment.section_id,
          currentSpeed: segment.actual_speed_kmh,
        };
      }
    }

    if (time < train.schedule[0]?.entry_time_minutes) {
      const startStation = stations.find((s) => s.id === train.start_station);
      return startStation
        ? {
          x: startStation.x,
          y: startStation.y,
          moving: false,
          atStation: train.start_station_name,
          waiting: true,
        }
        : null;
    }

    const lastSegment = train.schedule[train.schedule.length - 1];
    if (time > lastSegment?.exit_time_minutes) {
      const endStation = stations.find((s) => s.id === train.end_station);
      return endStation
        ? {
          x: endStation.x,
          y: endStation.y,
          moving: false,
          atStation: train.end_station_name,
          completed: true,
        }
        : null;
    }

    return null;
  };

  const getCurrentSpeed = (train: TrainResult, time: number): number => {
    if (!train.schedule) return 0;
    for (let segment of train.schedule) {
      if (
        time >= segment.entry_time_minutes &&
        time <= segment.exit_time_minutes
      ) {
        return segment.actual_speed_kmh || train.max_speed_kmh;
      }
    }
    return 0;
  };

  const getTrainStatus = (
    train: TrainResult,
    time: number,
  ): TrainStatusResult["status"] => {
    if (!train.schedule || train.schedule.length === 0) return "idle";

    const firstEntry = train.schedule[0]?.entry_time_minutes || 0;
    const lastExit =
      train.schedule[train.schedule.length - 1]?.exit_time_minutes || 0;

    if (time < firstEntry) return "waiting";
    if (time > lastExit) return "completed";
    return "running";
  };

  const getTrainColor = (trainId: number): string => {
    const colors: string[] = [
      "#ef4444",
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#ec4899",
      "#14b8a6",
      "#f97316",
    ];
    return colors[(trainId - 1) % colors.length] || "#6b7280";
  };

  const getMaxTime = () => {
    if (!simulationData?.output?.train_results) return 0;
    return Math.max(
      ...Object.values(simulationData.output.train_results).map((train) => {
        const t = train as TrainResult;
        if (!t.schedule || t.schedule.length === 0) return 0;
        return Math.max(...t.schedule.map((s) => s.exit_time_minutes || 0));
      }),
    );
  };

  // Zoom functions
  const zoomIn = () => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const delta = 1.2;
    const newZoom = Math.min(zoom * delta, 3);

    const zoomPoint = {
      x: (centerX - panX) / zoom,
      y: (centerY - panY) / zoom,
    };

    setZoom(newZoom);
    setPanX(centerX - zoomPoint.x * newZoom);
    setPanY(centerY - zoomPoint.y * newZoom);
  };

  const zoomOut = () => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const delta = 1 / 1.2;
    const newZoom = Math.max(zoom * delta, 0.3);

    const zoomPoint = {
      x: (centerX - panX) / zoom,
      y: (centerY - panY) / zoom,
    };

    setZoom(newZoom);
    setPanX(centerX - zoomPoint.x * newZoom);
    setPanY(centerY - zoomPoint.y * newZoom);
  };

  const resetView = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  // Pan functions
  const handlePanStart = (e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  const handlePanMove = (e: MouseEvent) => {
    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
    }
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  const animate = (timestamp: number) => {
    if (!isPlaying) return;

    if (timestamp - lastUpdateRef.current > 100 / speed) {
      setCurrentTime((prev) => {
        const maxTime = getMaxTime();
        return prev >= maxTime ? 0 : prev + 0.1;
      });
      lastUpdateRef.current = timestamp;
    }

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, speed]);

  // Pan event listeners
  useEffect(() => {
    if (isPanning) {
      document.addEventListener("mousemove", handlePanMove);
      document.addEventListener("mouseup", handlePanEnd);
      return () => {
        document.removeEventListener("mousemove", handlePanMove);
        document.removeEventListener("mouseup", handlePanEnd);
      };
    }
  }, [isPanning, panStart]);

  // Wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!canvasRef.current) return;
      e.preventDefault();

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.3, Math.min(3, zoom * delta));

      const zoomPoint = {
        x: (mouseX - panX) / zoom,
        y: (mouseY - panY) / zoom,
      };

      setZoom(newZoom);
      setPanX(mouseX - zoomPoint.x * newZoom);
      setPanY(mouseY - zoomPoint.y * newZoom);
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("wheel", handleWheel, { passive: false });
      return () => canvas.removeEventListener("wheel", handleWheel);
    }
  }, [zoom, panX, panY]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const stop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };
  const reset = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const stations = getStationPositions();
  const sections = getSectionInfo();
  const trainPositions = getTrainPositions();

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-neutral-900 to-neutral-800 text-white">
      {/* Header */}
      <div className="p-6 border-b border-neutral-700">
        <h1 className={`${instrumentSerif.className} text-3xl font-bold mb-1`}>
          Advanced Train Network Simulation
        </h1>
        <p className="text-neutral-300 text-sm">
          Real-time train scheduling with bidirectional tracks and performance
          metrics
        </p>
      </div>
      {!simulationData && (
        <div className="p-8 m-6 border-2 border-dashed border-neutral-600 rounded-none text-center bg-neutral-800/50">
          <Train className="mx-auto mb-4 w-16 h-16 text-neutral-400" />
          <h3 className="text-xl font-semibold text-neutral-200 mb-2">
            No Simulation Data
          </h3>
          <p className="text-neutral-400 mb-4">
            Use the Railway Builder to create a network and compute paths to see
            the simulation
          </p>
        </div>
      )}
      {simulationData && (
        <div className="flex flex-col h-screen">
          <div className="p-4 bg-neutral-800 border-b border-neutral-700">
            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={togglePlay}
                className={`px-6 py-3 rounded-none flex items-center gap-2 font-medium transition-colors ${isPlaying ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}`}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                {isPlaying ? "Pause" : "Play"}
              </Button>

              <Button
                onClick={stop}
                className="px-6 py-3 bg-red-600 hover:bg-red-600  rounded-none flex items-center gap-2 transition-colors font-medium"
              >
                <Square className="w-5 h-5" />
                Stop
              </Button>

              <Button
                onClick={reset}
                className="px-6 py-3 bg-neutral-600 hover:bg-neutral-700 rounded-none flex items-center gap-2 transition-colors font-medium"
              >
                <RotateCcw className="w-5 h-5" />
                Reset
              </Button>
              <div className="flex items-center gap-2 ml-6 border-l border-neutral-600 pl-6">
                <span className="text-sm font-medium text-neutral-300">
                  Panels:
                </span>
                <Button
                  variant="outline"
                  onClick={() => setLeftPaneCollapsed(!leftPaneCollapsed)}
                  className={`px-2 py-2 flex items-center rounded-none text-sm transition-colors text-black`}
                  title={
                    leftPaneCollapsed ? "Show Left Panel" : "Hide Left Panel"
                  }
                >
                  <ChevronRight
                    className={` transition-transform ${leftPaneCollapsed ? "rotate-0" : "rotate-180"}`}
                  />
                  Left
                </Button>
                <button
                  onClick={() => setRightPaneCollapsed(!rightPaneCollapsed)}
                  className={`px-3 py-2 rounded-none flex items-center gap-2 text-sm transition-colors border bg-neutral-900 border-neutral-700`}
                  title={
                    rightPaneCollapsed ? "Show Right Panel" : "Hide Right Panel"
                  }
                >
                  Right
                  <ChevronLeft
                    className={`w-4 h-4 transition-transform ${rightPaneCollapsed ? "rotate-0" : "rotate-180"}`}
                  />
                </button>
              </div>

              <div className="flex items-center gap-2 ml-6 border-l border-neutral-600 pl-6">
                <span className="text-sm font-medium text-neutral-300">
                  View:
                </span>
                <Button
                  variant="outline"
                  onClick={zoomIn}
                  className="px-2 py-2 flex items-center rounded-none text-sm transition-colors text-black"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={zoomOut}
                  className="px-2 py-2 flex items-center rounded-none text-sm transition-colors text-black"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={resetView}
                  className="px-3 py-2 flex items-center rounded-none text-sm transition-colors text-black"
                  title="Reset View"
                >
                  1:1
                </Button>
                <div className="text-xs text-neutral-400">
                  {(zoom * 100).toFixed(0)}%
                </div>
              </div>

              <div className="flex items-center gap-3 ml-6">
                <label className="text-sm font-medium">Speed:</label>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm min-w-[3rem]">
                  {speed.toFixed(1)}x
                </span>
              </div>

              <div className="ml-auto flex items-center gap-4">
                <span className="text-lg font-semibold">
                  Time: {currentTime.toFixed(1)} min
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 w-full bg-neutral-700 rounded-none h-2">
              <div
                className="bg-white h-2 rounded-none transition-all duration-200"
                style={{
                  width: `${Math.min((currentTime / getMaxTime()) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="flex-1 flex overflow-hidden">
            {!leftPaneCollapsed && (
              <div className="w-64 flex-shrink-0 transition-all duration-300">
                <LeftPane
                  stations={stations}
                  sections={sections}
                  trainPositions={trainPositions}
                />
              </div>
            )}
            <div
              className={`flex-1 transition-all duration-300 ${leftPaneCollapsed && rightPaneCollapsed ? "mx-2" : leftPaneCollapsed || rightPaneCollapsed ? "mx-1" : ""}`}
            >
              <div className="absolute top-1 left-1 z-10 bg-black/60 text-white p-1.5 rounded text-xs leading-tight">
                <div>
                  Stations: {stations.length} | Sections: {sections.length}
                </div>
                <div>
                  Trains: {trainPositions.length} | Time:{" "}
                  {currentTime.toFixed(1)}m
                </div>
              </div>
              <div
                ref={canvasRef}
                className="w-full h-full relative bg-neutral-900 overflow-hidden"
                onMouseDown={handlePanStart}
                style={{ cursor: isPanning ? "grabbing" : "grab" }}
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 1000 700"
                  className="border border-neutral-700 bg-neutral-900"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <g
                    transform={`translate(${panX / zoom}, ${panY / zoom}) scale(${zoom})`}
                  >
                    {/* <defs>
                      <pattern
                        id="grid"
                        width="50"
                        height="50"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 50 0 L 0 0 0 50"
                          fill="none"
                          stroke="#475569"
                          strokeWidth="1"
                          opacity="0.3"
                        />
                      </pattern>
                    </defs> */}
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    {sections.map((section) => {
                      if (!section.fromPos || !section.toPos) return null;
                      return (
                        <g key={section.id}>
                          <line
                            x1={section.fromPos.x}
                            y1={section.fromPos.y}
                            x2={section.toPos.x}
                            y2={section.toPos.y}
                            stroke="#64748b"
                            strokeWidth="3"
                            strokeDasharray={
                              section.bidirectional ? "none" : "5,5"
                            }
                          />
                          {/* Distance Label */}
                          <text
                            x={(section.fromPos.x + section.toPos.x) / 2}
                            y={(section.fromPos.y + section.toPos.y) / 2 - 10}
                            fill="#94a3b8"
                            fontSize="10"
                            textAnchor="middle"
                          >
                            {section.distance}km
                          </text>
                        </g>
                      );
                    })}
                    {stations.map((station) => (
                      <g key={station.id}>
                        <circle
                          cx={station.x}
                          cy={station.y}
                          r="12"
                          fill="#525252"
                          stroke="#404040"
                          strokeWidth="2"
                        />
                        {/* Location Icon */}
                        <g
                          transform={`translate(${station.x - 4}, ${station.y - 4})`}
                        >
                          <path
                            d="M4 0C1.8 0 0 1.8 0 4C0 6.2 4 8 4 8S8 6.2 8 4C8 1.8 6.2 0 4 0ZM4 5.5C3.2 5.5 2.5 4.8 2.5 4C2.5 3.2 3.2 2.5 4 2.5C4.8 2.5 5.5 3.2 5.5 4C5.5 4.8 4.8 5.5 4 5.5Z"
                            fill="#ffffff"
                            stroke="none"
                            fontSize="8"
                          />
                        </g>
                        <text
                          x={station.x}
                          y={station.y - 15}
                          fill="#e2e8f0"
                          fontSize="12"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {station.name}
                        </text>
                        <text
                          x={station.x}
                          y={station.y + 25}
                          fill="#94a3b8"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          ID: {station.id}
                        </text>
                      </g>
                    ))}

                    {/* Trains */}
                    {trainPositions.map((train) => {
                      if (!train.position) return null;
                      return (
                        <g key={train.id}>
                          <circle
                            cx={train.position.x}
                            cy={train.position.y}
                            r="6"
                            fill={train.color}
                            stroke="#ffffff"
                            strokeWidth="2"
                          >
                            <animate
                              attributeName="r"
                              values="6;8;6"
                              dur="2s"
                              repeatCount="indefinite"
                            />
                          </circle>
                          <text
                            x={train.position.x + 10}
                            y={train.position.y - 5}
                            fill="#ffffff"
                            fontSize="10"
                            fontWeight="bold"
                          >
                            T{train.id}
                          </text>
                          <text
                            x={train.position.x + 10}
                            y={train.position.y + 10}
                            fill="#94a3b8"
                            fontSize="8"
                          >
                            {train.currentSpeed}km/h
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            </div>
            {!rightPaneCollapsed && (
              <div className="w-64 flex-shrink-0 transition-all duration-300">
                <RightPane
                  simulationData={simulationData}
                  trainPositions={trainPositions}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainSimulation;
