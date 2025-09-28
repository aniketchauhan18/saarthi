"use client";
/* eslint-disable */


import { instrumentSerif } from "@/lib/fonts";
import { Activity, Gauge, TrendingUp, Zap } from "lucide-react";
import React from "react";

const RightPane = ({ simulationData, trainPositions }: any) => {
  return (
    <div className="w-64 h-full bg-neutral-800/50 border-l border-neutral-700 overflow-y-auto hide-scrollbar">
      {/* Performance Metrics */}
      <div className="p-3 border-b border-neutral-700">
        <h3
          className={`text-xl font-semibold mb-2 flex items-center gap-2 ${instrumentSerif.className}`}
        >
          <TrendingUp className="w-4 h-4 text-green-400" />
          Performance
        </h3>
        <div className="space-y-2">
          <div className="bg-neutral-700/50 p-2">
            <div className="text-xs text-neutral-400 mb-1">
              Total Completion Time
            </div>
            <div className="text-lg font-semibold text-green-400">
              {simulationData.output.performance_metrics
                ?.total_completion_time_minutes || "N/A"}{" "}
              min
            </div>
          </div>
          <div className="bg-neutral-700/50 p-2">
            <div className="text-xs text-neutral-400 mb-1">Average Delay</div>
            <div className="text-lg font-semibold text-orange-400">
              {simulationData.output.performance_metrics
                ?.average_delay_minutes || "N/A"}{" "}
              min
            </div>
          </div>
          <div className="bg-neutral-700/50 p-2">
            <div className="text-xs text-neutral-400 mb-1">Success Rate</div>
            <div className="text-lg font-semibold text-blue-400">
              {simulationData.output.performance_metrics
                ?.success_rate_percent || "N/A"}
              %
            </div>
          </div>
          <div className="bg-neutral-700/50 p-2">
            <div className="text-xs text-neutral-400 mb-1">Total Delay</div>
            <div className="text-lg font-semibold text-red-400">
              {simulationData.output.performance_metrics?.total_delay_minutes ||
                "N/A"}{" "}
              min
            </div>
          </div>
        </div>
      </div>

      {/* Active Trains */}
      <div className="p-3">
        <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          Active Trains
        </h3>
        <div className="space-y-2">
          {trainPositions
            .filter((t: any) => t.status === "running")
            .map((train: any) => (
              <div key={train.id} className="bg-neutral-700/50 p-2">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: train.color }}
                  />
                  <span className="font-medium text-xs">Train {train.id}</span>
                  <Gauge className="w-3 h-3 text-blue-400 ml-auto" />
                </div>
                {train.position.moving ? (
                  <div className="text-xs text-neutral-400 space-y-0.5">
                    <div className="truncate">
                      From: {train.position.fromStation}
                    </div>
                    <div className="truncate">
                      To: {train.position.toStation}
                    </div>
                    <div className="flex justify-between">
                      <span>Progress:</span>
                      <span className="text-green-400">
                        {train.position.progress}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Speed:</span>
                      <span className="text-yellow-400">
                        {train.currentSpeed}km/h
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400 truncate">
                    At: {train.position.atStation}
                  </div>
                )}
              </div>
            ))}
          {trainPositions.filter((t: any) => t.status === "running").length ===
            0 && (
            <div className="text-center text-neutral-400 py-6">
              <Zap className="w-6 h-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">No trains currently running</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RightPane;
