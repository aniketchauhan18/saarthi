"use client";
import { instrumentSerif } from "@/lib/fonts";
import { MapPin, Navigation, Train } from "lucide-react";
import React from "react";
const LeftPane = ({ stations, sections, trainPositions }: any) => {
  return (
    <div className="w-64 h-full bg-neutral-800/50 border-r border-neutral-700 overflow-y-auto hide-scrollbar">
      <div className="p-3 border-b border-neutral-700">
        <h3
          className={`${instrumentSerif.className} text-xl font-semibold mb-2 flex items-center gap-2`}
        >
          <Navigation className="w-4 h-4 text-blue-400" />
          Network Layout
        </h3>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-400">Stations:</span>
            <span>{stations.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Sections:</span>
            <span>{sections.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Bidirectional:</span>
            <span>{sections.filter((s: any) => s.bidirectional).length}</span>
          </div>
        </div>
      </div>
      <div className="p-3 border-b border-neutral-700">
        <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-green-400" />
          Track Sections
        </h3>
        <div className="space-y-2">
          {sections.map((section: any) => (
            <div key={section.id} className="bg-neutral-700/50 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium truncate">
                  {section.fromName} → {section.toName}
                </span>
                {section.bidirectional && (
                  <span className="text-xs text-green-400 ml-1">↔</span>
                )}
              </div>
              <div className="text-xs text-neutral-400 space-y-0.5">
                <div className="flex justify-between">
                  <span>Distance:</span>
                  <span>{section.distance}km</span>
                </div>
                <div className="flex justify-between">
                  <span>Max Speed:</span>
                  <span>{section.maxSpeed}km/h</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
          <Train className="w-4 h-4 text-yellow-400" />
          Train Status
        </h3>
        <div className="space-y-2">
          {trainPositions.map((train: any) => (
            <div key={train.id} className="bg-neutral-700/50 p-2">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: train.color }}
                />
                <span className="font-medium text-xs">Train {train.id}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 ${train.status === "running" ? "bg-green-600" : train.status === "waiting" ? "bg-yellow-600" : "bg-neutral-600"}`}
                >
                  {train.status}
                </span>
              </div>
              <div className="text-xs text-neutral-400 space-y-0.5">
                <div className="truncate">Route: {train.route}</div>
                <div className="flex justify-between">
                  <span>Max Speed:</span>
                  <span>{train.maxSpeed}km/h</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Speed:</span>
                  <span>{train.currentSpeed}km/h</span>
                </div>
                <div className="flex justify-between">
                  <span>Delay:</span>
                  <span
                    className={
                      train.delay > 0 ? "text-red-400" : "text-green-400"
                    }
                  >
                    {train.delay}min
                  </span>
                </div>
                {train.position?.moving && (
                  <div className="flex justify-between">
                    <span>Progress:</span>
                    <span>{train.position.progress}%</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeftPane;
