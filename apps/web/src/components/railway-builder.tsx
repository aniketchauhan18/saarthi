"use client";
/* eslint-disable */


import {
  Calculator,
  Download,
  FileDown,
  GitBranch,
  Hand,
  Loader2,
  MapPin,
  Move,
  Pointer,
  Train,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import Presets from "./presets";
import { instrumentSerif } from "@/lib/fonts";

interface Station {
  id: number;
  name: string;
  x: number;
  y: number;
}
interface PresetConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  stations: Omit<Station, "id">[];
  sections: Omit<Section, "id" | "from" | "to">[];
  connections: Array<{ fromIndex: number; toIndex: number }>;
  width: number;
  height: number;
}
interface Section {
  id: number;
  from: number;
  to: number;
  distance: number;
  maxSpeed: number;
  bidirectional: boolean;
}
interface TrainConfig {
  id: number;
  startStation: number;
  endStation: number;
  maxSpeed: number;
  allowedSections: { [key: number]: 0 | 1 };
}
interface NetworkData {
  nb_stations: number;
  station_names: { [key: string]: string };
  nb_sections: number;
  nb_trains: number;
  sec_from: { [key: string]: number };
  sec_to: { [key: string]: number };
  sec_dist: { [key: string]: number };
  sec_vmax: { [key: string]: number };
  allowed_sections: { [key: string]: { [key: string]: 0 | 1 } };
  start_station: { [key: string]: number };
  end_station: { [key: string]: number };
  train_vmax: { [key: string]: number };
  headway: number;
  BIG_M: number;
}

interface RailwayBuilderProps {
  onComputeComplete: (data: any) => void;
}

export default function RailwayBuilder({
  onComputeComplete,
}: RailwayBuilderProps) {
  const [isComputing, setIsComputing] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [trains, setTrains] = useState<TrainConfig[]>([]);
  const [selectedTool, setSelectedTool] = useState<
    "station" | "section" | "train" | "select"
  >("station");
  const [connectingSection, setConnectingSection] = useState<{
    from: number;
  } | null>(null);
  const [selectedItem, setSelectedItem] = useState<{
    type: "station" | "section" | "train";
    id: number;
  } | null>(null);
  const [headway, setHeadway] = useState(3.0);
  const [bigM, setBigM] = useState(10000);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedStation, setDraggedStation] = useState<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const computePath = async () => {
    if (stations.length === 0 || sections.length === 0 || trains.length === 0) {
      alert(
        "Please add at least one station, section, and train before computing paths",
      );
      return;
    }

    setIsComputing(true);

    try {
      // Prepare the data in the expected format
      const exportSections: Array<{
        id: number;
        from: number;
        to: number;
        distance: number;
        maxSpeed: number;
      }> = [];
      let sectionId = 1;

      sections.forEach((section) => {
        exportSections.push({
          id: sectionId++,
          from: section.from,
          to: section.to,
          distance: section.distance,
          maxSpeed: section.maxSpeed,
        });
        if (section.bidirectional) {
          exportSections.push({
            id: sectionId++,
            from: section.to,
            to: section.from,
            distance: section.distance,
            maxSpeed: section.maxSpeed,
          });
        }
      });

      const requestData = {
        nb_stations: stations.length,
        station_names: stations.reduce(
          (acc, s) => ({ ...acc, [s.id]: s.name }),
          {},
        ),
        nb_sections: exportSections.length,
        nb_trains: trains.length,
        sec_from: exportSections.reduce(
          (acc, s) => ({ ...acc, [s.id]: s.from }),
          {},
        ),
        sec_to: exportSections.reduce(
          (acc, s) => ({ ...acc, [s.id]: s.to }),
          {},
        ),
        sec_dist: exportSections.reduce(
          (acc, s) => ({ ...acc, [s.id]: s.distance }),
          {},
        ),
        sec_vmax: exportSections.reduce(
          (acc, s) => ({ ...acc, [s.id]: s.maxSpeed }),
          {},
        ),
        allowed_sections: trains.reduce(
          (acc, t) => ({
            ...acc,
            [t.id]: exportSections.reduce((sacc, s) => {
              const originalSection = sections.find(
                (orig) =>
                  (orig.from === s.from && orig.to === s.to) ||
                  (orig.bidirectional &&
                    orig.from === s.to &&
                    orig.to === s.from),
              );
              const allowed = originalSection
                ? t.allowedSections[originalSection.id] || 0
                : 0;
              return { ...sacc, [s.id]: allowed };
            }, {}),
          }),
          {},
        ),
        start_station: trains.reduce(
          (acc, t) => ({ ...acc, [t.id]: t.startStation }),
          {},
        ),
        end_station: trains.reduce(
          (acc, t) => ({ ...acc, [t.id]: t.endStation }),
          {},
        ),
        train_vmax: trains.reduce(
          (acc, t) => ({ ...acc, [t.id]: t.maxSpeed }),
          {},
        ),
        headway,
        BIG_M: bigM,
      };

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8000";

      const response = await fetch(`${backendUrl}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      onComputeComplete(result);
      alert("Path computation completed successfully!");
    } catch (error) {
      console.error("Error computing path:", error);
      alert(
        `Error computing path: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsComputing(false);
    }
  };

  const getStationPos = (stationId: number) => {
    const station = stations.find((s) => s.id === stationId);
    if (!station) return { x: 0, y: 0 };
    return {
      x: station.x * zoom + panX,
      y: station.y * zoom + panY,
    };
  };
  const getRawStationPos = (stationId: number) => {
    const station = stations.find((s) => s.id === stationId);
    return station || { x: 0, y: 0 };
  };
  const screenToCanvas = (screenX: number, screenY: number) => {
    return {
      x: (screenX - panX) / zoom,
      y: (screenY - panY) / zoom,
    };
  };
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
  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;
      if (panMode || selectedTool === "select") {
        setIsPanning(true);
        setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
      }
    },
    [isDragging, panMode, selectedTool, panX, panY],
  );
  const handlePanMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning) {
        setPanX(e.clientX - panStart.x);
        setPanY(e.clientY - panStart.y);
      }
    },
    [isPanning, panStart],
  );
  const handlePanEnd = useCallback(() => {
    setIsPanning(false);
  }, []);
  useLayoutEffect(() => {
    const updateSize = () => {
      if (canvasRef.current) {
        setCanvasSize({
          width: canvasRef.current.offsetWidth,
          height: canvasRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || isPanning) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { x, y } = screenToCanvas(screenX, screenY);
    if (selectedTool === "station") {
      const newStation: Station = {
        id: stations.length + 1,
        name: `Station ${stations.length + 1}`,
        x,
        y,
      };
      setStations([...stations, newStation]);
    }
  };
  const handleStationClick = (stationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTool === "section") {
      if (!connectingSection) {
        setConnectingSection({ from: stationId });
      } else if (connectingSection.from !== stationId) {
        const existingSection = sections.find(
          (s) =>
            (s.from === connectingSection.from && s.to === stationId) ||
            (s.from === stationId && s.to === connectingSection.from),
        );
        if (!existingSection) {
          const newSection: Section = {
            id: sections.length + 1,
            from: connectingSection.from,
            to: stationId,
            distance: 10.0,
            maxSpeed: 100.0,
            bidirectional: true,
          };
          setSections([...sections, newSection]);
        }
        setConnectingSection(null);
      } else {
        setConnectingSection(null);
      }
    } else if (selectedTool === "select") {
      setSelectedItem({ type: "station", id: stationId });
    }
  };
  const handleStationMouseDown = (stationId: number, e: React.MouseEvent) => {
    if (selectedTool === "select") {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      setDraggedStation(stationId);
    }
  };
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (canvasRef.current && connectingSection) {
        const rect = canvasRef.current.getBoundingClientRect();
        const { x, y } = screenToCanvas(
          e.clientX - rect.left,
          e.clientY - rect.top,
        );
        setMousePos({ x, y });
      }
      if (isDragging && draggedStation && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const { x, y } = screenToCanvas(screenX, screenY);
        setStations((prev) =>
          prev.map((s) => (s.id === draggedStation ? { ...s, x, y } : s)),
        );
        return;
      }
      if (isPanning) {
        handlePanMove(e);
        return;
      }
    },
    [
      isDragging,
      draggedStation,
      isPanning,
      handlePanMove,
      screenToCanvas,
      connectingSection,
    ],
  );
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedStation(null);
    handlePanEnd();
  }, [handlePanEnd]);
  useEffect(() => {
    if (isDragging || isPanning || connectingSection) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [
    isDragging,
    isPanning,
    connectingSection,
    handleMouseMove,
    handleMouseUp,
  ]);
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
  const handleSectionClick = (sectionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedTool === "select") {
      setSelectedItem({ type: "section", id: sectionId });
    }
  };
  const handleAddPreset = (preset: PresetConfig, x: number, y: number) => {
    const nextStationId = Math.max(...stations.map((s) => s.id), 0) + 1;
    const nextSectionId = Math.max(...sections.map((s) => s.id), 0) + 1;
    const newStations: Station[] = preset.stations.map((station, index) => ({
      id: nextStationId + index,
      name: `${station.name}_${nextStationId + index}`,
      x: x + station.x,
      y: y + station.y,
    }));
    const newSections: Section[] = preset.sections.map((section, index) => {
      const connection = preset.connections[index];
      return {
        id: nextSectionId + index,
        from: nextStationId + connection.fromIndex,
        to: nextStationId + connection.toIndex,
        distance: section.distance,
        maxSpeed: section.maxSpeed,
        bidirectional: section.bidirectional,
      };
    });
    setStations([...stations, ...newStations]);
    setSections([...sections, ...newSections]);
    setTrains(
      trains.map((train) => ({
        ...train,
        allowedSections: {
          ...train.allowedSections,
          ...newSections.reduce(
            (acc, section) => ({ ...acc, [section.id]: 0 }),
            {},
          ),
        },
      })),
    );
  };
  const addTrain = () => {
    if (stations.length < 2) {
      alert("Add at least 2 stations first");
      return;
    }
    const newTrain: TrainConfig = {
      id: trains.length + 1,
      startStation: stations[0].id,
      endStation: stations[stations.length - 1].id,
      maxSpeed: 100.0,
      allowedSections: sections.reduce((acc, s) => ({ ...acc, [s.id]: 1 }), {}),
    };
    setTrains([...trains, newTrain]);
  };
  const deleteSelected = () => {
    if (!selectedItem) return;
    if (selectedItem.type === "station") {
      setStations(stations.filter((s) => s.id !== selectedItem.id));
      setSections(
        sections.filter(
          (s) => s.from !== selectedItem.id && s.to !== selectedItem.id,
        ),
      );
      setTrains(
        trains.map((t) => ({
          ...t,
          startStation:
            t.startStation === selectedItem.id
              ? stations[0]?.id || 1
              : t.startStation,
          endStation:
            t.endStation === selectedItem.id
              ? stations[0]?.id || 1
              : t.endStation,
        })),
      );
    } else if (selectedItem.type === "section") {
      setSections(sections.filter((s) => s.id !== selectedItem.id));
      setTrains(
        trains.map((t) => ({
          ...t,
          allowedSections: { ...t.allowedSections, [selectedItem.id]: 0 },
        })),
      );
    } else if (selectedItem.type === "train") {
      setTrains(trains.filter((t) => t.id !== selectedItem.id));
    }
    setSelectedItem(null);
  };
  const exportData = () => {
    const exportSections: Array<{
      id: number;
      from: number;
      to: number;
      distance: number;
      maxSpeed: number;
    }> = [];
    let sectionId = 1;
    sections.forEach((section) => {
      exportSections.push({
        id: sectionId++,
        from: section.from,
        to: section.to,
        distance: section.distance,
        maxSpeed: section.maxSpeed,
      });
      if (section.bidirectional) {
        exportSections.push({
          id: sectionId++,
          from: section.to,
          to: section.from,
          distance: section.distance,
          maxSpeed: section.maxSpeed,
        });
      }
    });
    const data: NetworkData = {
      nb_stations: stations.length,
      station_names: stations.reduce(
        (acc, s) => ({ ...acc, [s.id]: s.name }),
        {},
      ),
      nb_sections: exportSections.length,
      nb_trains: trains.length,
      sec_from: exportSections.reduce(
        (acc, s) => ({ ...acc, [s.id]: s.from }),
        {},
      ),
      sec_to: exportSections.reduce((acc, s) => ({ ...acc, [s.id]: s.to }), {}),
      sec_dist: exportSections.reduce(
        (acc, s) => ({ ...acc, [s.id]: s.distance }),
        {},
      ),
      sec_vmax: exportSections.reduce(
        (acc, s) => ({ ...acc, [s.id]: s.maxSpeed }),
        {},
      ),
      allowed_sections: trains.reduce(
        (acc, t) => ({
          ...acc,
          [t.id]: exportSections.reduce((sacc, s) => {
            const originalSection = sections.find(
              (orig) =>
                (orig.from === s.from && orig.to === s.to) ||
                (orig.bidirectional &&
                  orig.from === s.to &&
                  orig.to === s.from),
            );
            const allowed = originalSection
              ? t.allowedSections[originalSection.id] || 0
              : 0;
            return { ...sacc, [s.id]: allowed };
          }, {}),
        }),
        {},
      ),
      start_station: trains.reduce(
        (acc, t) => ({ ...acc, [t.id]: t.startStation }),
        {},
      ),
      end_station: trains.reduce(
        (acc, t) => ({ ...acc, [t.id]: t.endStation }),
        {},
      ),
      train_vmax: trains.reduce(
        (acc, t) => ({ ...acc, [t.id]: t.maxSpeed }),
        {},
      ),
      headway,
      BIG_M: bigM,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "train_data.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const updateSelectedItem = (property: string, value: any) => {
    if (!selectedItem) return;
    if (selectedItem.type === "station") {
      setStations(
        stations.map((s) =>
          s.id === selectedItem.id ? { ...s, [property]: value } : s,
        ),
      );
    } else if (selectedItem.type === "section") {
      setSections(
        sections.map((s) =>
          s.id === selectedItem.id
            ? {
                ...s,
                [property]:
                  property === "bidirectional" ? value : parseFloat(value) || 0,
              }
            : s,
        ),
      );
    } else if (selectedItem.type === "train") {
      setTrains(
        trains.map((t) =>
          t.id === selectedItem.id
            ? {
                ...t,
                [property]: property.includes("Station")
                  ? parseInt(value)
                  : parseFloat(value) || 0,
              }
            : t,
        ),
      );
    }
  };
  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data: NetworkData = JSON.parse(e.target?.result as string);
        const importedStations: Station[] = Object.entries(
          data.station_names,
        ).map(([id, name], index) => ({
          id: parseInt(id),
          name,
          x: 100 + (index % 4) * 150,
          y: 100 + Math.floor(index / 4) * 150,
        }));
        setStations(importedStations);
        const importedSections: Section[] = [];
        const processedPairs = new Set<string>();
        Object.entries(data.sec_from).forEach(([sectionId, from]) => {
          const to = data.sec_to[sectionId];
          const distance = data.sec_dist[sectionId];
          const maxSpeed = data.sec_vmax[sectionId];
          const pairKey = `${Math.min(from, to)}-${Math.max(from, to)}`;
          if (!processedPairs.has(pairKey)) {
            const reverseSection = Object.entries(data.sec_from).find(
              ([revId, revFrom]) =>
                revId !== sectionId &&
                revFrom === to &&
                data.sec_to[revId] === from,
            );
            importedSections.push({
              id: importedSections.length + 1,
              from,
              to,
              distance,
              maxSpeed,
              bidirectional: !!reverseSection,
            });
            processedPairs.add(pairKey);
          }
        });
        setSections(importedSections);
        const importedTrains: TrainConfig[] = Object.entries(
          data.start_station,
        ).map(([trainId, startStation]) => ({
          id: parseInt(trainId),
          startStation,
          endStation: data.end_station[trainId],
          maxSpeed: data.train_vmax[trainId],
          allowedSections: importedSections.reduce((acc, s) => {
            const isAllowed = Object.entries(data.sec_from).some(
              ([expSecId, expFrom]) => {
                const expTo = data.sec_to[expSecId];
                const sectionMatches =
                  (s.from === expFrom && s.to === expTo) ||
                  (s.bidirectional && s.from === expTo && s.to === expFrom);
                return (
                  sectionMatches &&
                  data.allowed_sections[trainId]?.[expSecId] === 1
                );
              },
            );
            return { ...acc, [s.id]: isAllowed ? 1 : 0 };
          }, {}),
        }));
        setTrains(importedTrains);
        setHeadway(data.headway);
        setBigM(data.BIG_M);
        alert("Data imported successfully!");
      } catch (error) {
        alert("Error importing data: " + error);
      }
    };
    reader.readAsText(file);
  };
  const toggleTrainSection = (trainId: number, sectionId: number) => {
    setTrains(
      trains.map((t) =>
        t.id === trainId
          ? {
              ...t,
              allowedSections: {
                ...t.allowedSections,
                [sectionId]: t.allowedSections[sectionId] === 1 ? 0 : 1,
              },
            }
          : t,
      ),
    );
  };
  const getTotalSectionCount = () => {
    return sections.reduce(
      (count, section) => count + (section.bidirectional ? 2 : 1),
      0,
    );
  };
  const getSectionInfo = (section: Section) => {
    const fromStation = stations.find((s) => s.id === section.from);
    const toStation = stations.find((s) => s.id === section.to);
    return {
      from: fromStation?.name || `Station ${section.from}`,
      to: toStation?.name || `Station ${section.to}`,
    };
  };
  return (
    <div className="w-full h-screen flex bg-neutral-900 text-white">
      <div className="w-70 bg-neutral-800 overflow-y-auto hide-scrollbar">
        <h1
          className={`text-xl px-4 border-b border-neutral-700 py-3 font-bold mb-6 sticky bg-neutral-800 top-0  ${instrumentSerif.className}`}
        >
          Saarthi Railway Builder
        </h1>
        <div className="p-4 space-y-6 pt-0">
          <div className="mb-6">
            <h3 className="text-sm uppercase text-neutral-400 mb-2">Tools</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setSelectedTool("select");
                  setConnectingSection(null);
                }}
                className={`p-3 border flex flex-col items-center gap-1 transition-all duration-150 ease-out ${selectedTool === "select" ? "bg-white text-black border border-neutral-600" : "bg-neutral-700 border-neutral-600"}`}
              >
                <Hand className="size-3.5" />
                <span className="text-xs">Select</span>
              </button>
              <button
                onClick={() => {
                  setSelectedTool("station");
                  setConnectingSection(null);
                }}
                className={`p-3 flex flex-col items-center gap-1 transition-all ${selectedTool === "station" ? "bg-white text-black" : "bg-neutral-700 hover:bg-neutral-600"}`}
              >
                <MapPin className="size-3.5" />
                <span className="text-xs">Station</span>
              </button>
              <button
                onClick={() => setSelectedTool("section")}
                className={`p-3 flex flex-col items-center gap-1 transition-all ${selectedTool === "section" ? "bg-white text-black" : "bg-neutral-700 hover:bg-neutral-600"}`}
              >
                <GitBranch className="size-3.5" />
                <span className="text-xs">Section</span>
              </button>
              <button
                onClick={addTrain}
                className="p-3 bg-neutral-700 hover:bg-neutral-600 flex flex-col items-center gap-1 transition-all"
              >
                <Train className="size-3.5" />
                <span className="text-xs">Add Train</span>
              </button>
            </div>

            {/* Compute Path Button */}
            <div className="mb-6 mt-2">
              <Button
                onClick={computePath}
                variant="outline"
                disabled={
                  isComputing ||
                  stations.length === 0 ||
                  sections.length === 0 ||
                  trains.length === 0
                }
                className="w-full h-10 disabled:cursor-not-allowed flex items-center justify-center rounded-none gap-2 transition-all font-medium text-black"
              >
                {isComputing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Computing...</span>
                  </>
                ) : (
                  <>
                    <Calculator className="size-4" />
                    <span>Compute Path</span>
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="mb-6">
            <h3 className="text-sm uppercase text-neutral-400 mb-2">
              View Controls
            </h3>
            <div className="space-y-2">
              <div className="text-xs text-neutral-300 mb-2 text-center">
                Zoom: {(zoom * 100).toFixed(0)}%
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={zoomIn}
                  variant="outline"
                  className="p-2 text-black rounded-none flex items-center justify-center gap-1 transition-all"
                  title="Zoom In"
                >
                  <ZoomIn className="size-4" />
                </Button>
                <Button
                  onClick={zoomOut}
                  variant="outline"
                  className="p-2 text-black rounded-none flex items-center justify-center gap-1 transition-all"
                  title="Zoom Out"
                >
                  <ZoomOut className="size-4" />
                </Button>
                <Button
                  onClick={resetView}
                  variant="outline"
                  className="p-2 text-black rounded-none flex items-center justify-center gap-1 transition-all text-xs"
                  title="Reset View"
                >
                  1:1
                </Button>
              </div>
              <Button
                onClick={() => setPanMode(!panMode)}
                className={`w-full p-2 rounded-none flex h-8 font-light text-xs items-center justify-center gap-2 transition-all ${panMode ? "bg-orange-600 hover:bg-orange-700" : "bg-neutral-700 hover:bg-neutral-600"}`}
              >
                <Move size={16} />
                <span className="text-sm">
                  {panMode ? "Pan Mode ON" : "Pan Mode OFF"}
                </span>
              </Button>
              <div className="text-xs text-neutral-400 text-center">
                Zoom: {(zoom * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          {}
          <div className="mb-6">
            <h3 className="text-sm uppercase text-neutral-400 mb-2">Data</h3>
            <div className="space-y-2">
              <label className="w-full p-2 bg-white text-black h-8 text-xs 0 flex items-center justify-center gap-2 transition-all cursor-pointer">
                <Download className="size-3" />
                <span className="text-sm">Import JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          {selectedItem && (
            <div className="mb-6 p-3 bg-neutral-900">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs uppercase text-neutral-300">
                  {selectedItem.type} Properties
                </h3>
                <button
                  onClick={deleteSelected}
                  className="p-1 bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
              {selectedItem.type === "station" && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-neutral-400">
                      Station Name
                    </Label>
                    <Input
                      type="text"
                      value={
                        stations.find((s) => s.id === selectedItem.id)?.name ||
                        ""
                      }
                      onChange={(e) =>
                        updateSelectedItem("name", e.target.value)
                      }
                      className="w-full p-2 bg-neutral-800 focus-visible:ring-0 border-0 rounded-none text-sm"
                      placeholder="Station Name"
                    />
                  </div>
                </div>
              )}
              {selectedItem.type === "section" && (
                <div className="space-y-3">
                  <div className="text-sm text-neutral-300">
                    {(() => {
                      const info = getSectionInfo(
                        sections.find((s) => s.id === selectedItem.id)!,
                      );
                      return `${info.from} ↔ ${info.to}`;
                    })()}
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-400 font-normal">
                      Distance (km)
                    </Label>
                    <Input
                      type="number"
                      value={
                        sections.find((s) => s.id === selectedItem.id)
                          ?.distance || 0
                      }
                      onChange={(e) =>
                        updateSelectedItem("distance", e.target.value)
                      }
                      className="w-full p-2 focus-visible:ring-0 bg-neutral-800 rounded-none border-0 text-sm"
                      step="0.1"
                      min="0.1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-400 font-normal">
                      Max Speed (km/h)
                    </Label>
                    <Input
                      type="number"
                      value={
                        sections.find((s) => s.id === selectedItem.id)
                          ?.maxSpeed || 0
                      }
                      onChange={(e) =>
                        updateSelectedItem("maxSpeed", e.target.value)
                      }
                      className="w-full p-2  focus-visible:ring-0 bg-neutral-800 rounded-none border-0 text-sm"
                      step="10"
                      min="10"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="checkbox"
                      checked={
                        sections.find((s) => s.id === selectedItem.id)
                          ?.bidirectional || false
                      }
                      onChange={(e) =>
                        updateSelectedItem("bidirectional", e.target.checked)
                      }
                      className="rounded size-2.5"
                      id="bidirectional"
                    />
                    <Label
                      htmlFor="bidirectional"
                      className="text-xs text-neutral-400"
                    >
                      Bidirectional
                    </Label>
                  </div>
                </div>
              )}
              {selectedItem.type === "train" && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-neutral-400">
                      Max Speed (km/h)
                    </Label>
                    <Input
                      type="number"
                      value={
                        trains.find((t) => t.id === selectedItem.id)
                          ?.maxSpeed || 0
                      }
                      onChange={(e) =>
                        updateSelectedItem("maxSpeed", e.target.value)
                      }
                      className="w-full p-2 focus-visible:ring-0 bg-neutral-800 rounded-none border-0 text-sm"
                      step="10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-400">
                      Start Station
                    </Label>
                    <select
                      value={
                        trains.find((t) => t.id === selectedItem.id)
                          ?.startStation || ""
                      }
                      onChange={(e) =>
                        updateSelectedItem("startStation", e.target.value)
                      }
                      className="w-full p-2 bg-neutral-800 rounded text-sm"
                    >
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-neutral-400">
                      End Station
                    </Label>
                    <select
                      value={
                        trains.find((t) => t.id === selectedItem.id)
                          ?.endStation || ""
                      }
                      onChange={(e) =>
                        updateSelectedItem("endStation", e.target.value)
                      }
                      className="w-full p-2 bg-neutral-800 rounded text-sm"
                    >
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
          {sections.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm uppercase text-neutral-400 mb-2">
                Sections
              </h3>
              <div className="space-y-1 max-h-32 overflow-y-auto hide-scrollbar">
                {sections.map((section) => {
                  const info = getSectionInfo(section);
                  return (
                    <div
                      key={section.id}
                      onClick={() =>
                        setSelectedItem({ type: "section", id: section.id })
                      }
                      className={`p-2 cursor-pointer  text-xs transition-all ${selectedItem?.type === "section" && selectedItem.id === section.id ? "bg-neutral-900 text-white" : "bg-neutral-700 hover:bg-neutral-600"}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">
                          Section {section.id}
                        </span>
                        <span className="text-neutral-300">
                          {section.distance}km, {section.maxSpeed}km/h
                        </span>
                      </div>
                      <div className="text-neutral-300 mt-1">
                        {info.from} {section.bidirectional ? "↔" : "→"}{" "}
                        {info.to}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {}
          <div className="mb-6">
            <h3 className="text-sm uppercase text-neutral-400 mb-2">
              Network Overview
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-400 text-xs">Stations:</span>
                <span>{stations.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400 text-xs">Sections (UI):</span>
                <span>{sections.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400 text-xs">
                  Sections (Export):
                </span>
                <span>{getTotalSectionCount()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400 text-xs">Trains:</span>
                <span>{trains.length}</span>
              </div>
            </div>
          </div>
          {}
          <div className="mb-6">
            <h3 className="text-sm uppercase text-neutral-400 mb-2">
              Global Settings
            </h3>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-neutral-400">
                  Headway (min)
                </Label>
                <Input
                  type="number"
                  value={headway}
                  onChange={(e) => setHeadway(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 shadow-none focus-visible:ring-0 bg-neutral-700 rounded-none border-0 text-sm"
                  step="0.5"
                />
              </div>
              <div>
                <Label className="text-xs text-neutral-400">BIG_M</Label>
                <Input
                  type="number"
                  value={bigM}
                  onChange={(e) => setBigM(parseInt(e.target.value) || 10000)}
                  className="w-full p-2 shadow-none focus-visible:ring-0 bg-neutral-700 rounded-none border-0 text-sm"
                  step="1000"
                />
              </div>
            </div>
          </div>
          {}
          {trains.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm uppercase text-neutral-400 mb-2">
                Trains
              </h3>
              <div className="space-y-2">
                {trains.map((train) => (
                  <div
                    key={train.id}
                    onClick={() =>
                      setSelectedItem({ type: "train", id: train.id })
                    }
                    className={`p-2 cursor-pointer transition-all ${selectedItem?.type === "train" && selectedItem.id === train.id ? "bg-neutral-900 text-white" : "bg-neutral-700 hover:bg-neutral-600"}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-sm">
                        Train {train.id}
                      </span>
                      <span className="text-xs text-neutral-300">
                        {train.maxSpeed} km/h
                      </span>
                    </div>
                    <div className="text-xs text-neutral-300 mt-1">
                      {stations.find((s) => s.id === train.startStation)
                        ?.name || "Unknown"}{" "}
                      →
                      {stations.find((s) => s.id === train.endStation)?.name ||
                        "Unknown"}
                    </div>
                    {selectedItem?.type === "train" &&
                      selectedItem.id === train.id &&
                      sections.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-neutral-600">
                          <div className="text-xs text-neutral-400 mb-1">
                            Allowed Sections:
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                            {sections.map((section) => (
                              <button
                                key={section.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTrainSection(train.id, section.id);
                                }}
                                className={`px-2 py-1 text-xs ${train.allowedSections[section.id] === 1 ? "bg-white text-black" : "bg-neutral-600 hover:bg-neutral-500"}`}
                              >
                                S{section.id}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <Button
            onClick={exportData}
            disabled={stations.length === 0 || sections.length === 0}
            className="w-full h-8 border border-neutral-700/80 font-normal text-xs  disabled:bg-neutral-700 disabled:cursor-not-allowed flex items-center justify-center rounded-none gap-2 transition-all"
          >
            <FileDown className="size-3" />
            Export JSON
          </Button>
        </div>
      </div>
      {}
      <div className="flex-1 relative bg-neutral-950 overflow-hidden">
        <div className="absolute top-4 left-4 bg-neutral-800 border p-3 border-neutral-700 shadow-lg">
          <div className="flex items-center gap-2 text-xs">
            {selectedTool === "station" && (
              <>
                <Pointer className="text-cyan-400 size-3" />
                <span>Click to place stations</span>
              </>
            )}
            {selectedTool === "section" && (
              <>
                <Pointer className="text-cyan-400 size-3" />
                <span>
                  {connectingSection
                    ? "Click destination station"
                    : "Click source station"}
                </span>
              </>
            )}
            {selectedTool === "select" && (
              <>
                <Pointer className="text-cyan-400 size-3" />
                <span>Click to select, drag to move</span>
              </>
            )}
          </div>
        </div>
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseDown={handlePanStart}
          className="w-full h-full relative"
          style={{
            cursor:
              selectedTool === "station"
                ? "crosshair"
                : panMode
                  ? "move"
                  : isDragging
                    ? "grabbing"
                    : "default",
          }}
        >
          {}
          <div
            className="absolute inset-0 w-full h-full origin-top-left"
            style={{
              transform: `scale(${zoom}) translate(${panX / zoom}px, ${panY / zoom}px)`,
            }}
          >
            {}
            <svg
              className="absolute pointer-events-none"
              style={{
                left: "-5000px",
                top: "-5000px",
                width: "15000px",
                height: "15000px",
              }}
            >
              {sections.map((section) => {
                const fromStation = stations.find((s) => s.id === section.from);
                const toStation = stations.find((s) => s.id === section.to);
                if (!fromStation || !toStation) return null;
                const svgOffsetX = 5000;
                const svgOffsetY = 5000;
                const fromX = fromStation.x + svgOffsetX;
                const fromY = fromStation.y + svgOffsetY;
                const toX = toStation.x + svgOffsetX;
                const toY = toStation.y + svgOffsetY;
                const midX = (fromX + toX) / 2;
                const midY = (fromY + toY) / 2;
                return (
                  <g key={section.id}>
                    <line
                      x1={fromX}
                      y1={fromY}
                      x2={toX}
                      y2={toY}
                      stroke={
                        selectedItem?.type === "section" &&
                        selectedItem.id === section.id
                          ? "#06b6d4"
                          : "#4b5563"
                      }
                      strokeWidth="3"
                      className="pointer-events-auto cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedTool === "select") {
                          setSelectedItem({ type: "section", id: section.id });
                        }
                      }}
                    />
                    {}
                    {section.bidirectional ? (
                      <>
                        <polygon
                          points={`${midX - 5},${midY - 3} ${midX + 5},${midY} ${midX - 5},${midY + 3}`}
                          fill="#06b6d4"
                          className="pointer-events-none"
                        />
                        <polygon
                          points={`${midX + 5},${midY - 3} ${midX - 5},${midY} ${midX + 5},${midY + 3}`}
                          fill="#06b6d4"
                          className="pointer-events-none"
                        />
                      </>
                    ) : (
                      <polygon
                        points={`${midX - 5},${midY - 3} ${midX + 5},${midY} ${midX - 5},${midY + 3}`}
                        fill="#06b6d4"
                        className="pointer-events-none"
                      />
                    )}
                    <circle cx={fromX} cy={fromY} r="3" fill="#06b6d4" />
                    <circle cx={toX} cy={toY} r="3" fill="#06b6d4" />
                    <text
                      x={midX}
                      y={midY - 15}
                      fill="white"
                      fontSize="12"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {section.distance}km
                    </text>
                    <text
                      x={midX}
                      y={midY + 25}
                      fill="#9ca3af"
                      fontSize="10"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {section.maxSpeed}km/h
                    </text>
                  </g>
                );
              })}
              {}
              {connectingSection && (
                <line
                  x1={getRawStationPos(connectingSection.from).x + 5000}
                  y1={getRawStationPos(connectingSection.from).y + 5000}
                  x2={mousePos.x + 5000}
                  y2={mousePos.y + 5000}
                  stroke="#06b6d4"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  opacity="0.5"
                  className="pointer-events-none"
                />
              )}
            </svg>
            {}
            {stations.map((station) => (
              <div
                key={station.id}
                onClick={(e) => handleStationClick(station.id, e)}
                onMouseDown={(e) => handleStationMouseDown(station.id, e)}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${selectedItem?.type === "station" && selectedItem.id === station.id ? "scale-110" : ""} ${draggedStation === station.id ? "z-50 scale-110 shadow-2xl" : ""}`}
                style={{
                  left: station.x,
                  top: station.y,
                  cursor:
                    selectedTool === "section"
                      ? "pointer"
                      : selectedTool === "select"
                        ? draggedStation === station.id
                          ? "grabbing"
                          : "grab"
                        : "default",
                }}
              >
                <div
                  className={`relative ${connectingSection?.from === station.id ? "animate-pulse" : ""}`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${selectedItem?.type === "station" && selectedItem.id === station.id ? "bg-white text-black shadow-lg shadow-cyan-600/50" : connectingSection?.from === station.id ? "bg-yellow-600" : "bg-neutral-700 hover:bg-neutral-600"}`}
                  >
                    <MapPin size={20} />
                  </div>
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs whitespace-nowrap bg-neutral-800 px-2 py-1 rounded">
                    {station.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Presets
        onAddPreset={handleAddPreset}
        canvasWidth={canvasSize.width}
        canvasHeight={canvasSize.height}
      />
    </div>
  );
}
