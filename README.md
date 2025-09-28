# Project: Saarthi
**Problem Statement ID:** 25022
**Team Name:** Vertexa#!#

## Title
Maximizing Section Throughput Using AI-Powered Precise Train Traffic Control

## Background
Indian Railways manages train movements primarily through the experience of train traffic controllers. While effective, this manual approach faces limitations as network congestion and operational complexity grow. Trains of varying types and priorities must share limited track infrastructure across space and time, making optimal allocation a significant challenge. The problem is a large-scale combinatorial optimization task with numerous constraints such as safety, track resources, system of working, signalling system, platform availability, train schedules, and train priorities. As real-time decisions become increasingly complex, there is a growing need for intelligent, data-driven systems powered by optimization algorithms and AI to enhance efficiency, punctuality, and utilization of railway infrastructure.

## Detailed Description
Currently, experienced traffic controllers oversee operations and take real-time decisions—whether a train should proceed, halt, or be rerouted—based on operational conditions and institutional knowledge. With rising traffic volumes and higher expectations for punctuality, safety, and efficiency, manual decision-making alone is becoming insufficient.

The network is constrained by finite infrastructure—limited track sections, junctions, crossings, and platform capacities—shared by long-distance express, suburban local, freight, maintenance blocks, and unscheduled specials. Coordinating these movements across spatial (network layout) and temporal (scheduling) dimensions while maintaining safety and minimizing delays is formidable.

Within a section managed by a section controller, the core problem is to decide train precedence and crossings to maximize throughput and minimize overall train travel time, considering section characteristics (e.g., line capacity, gradients, signal placements) and varying train priorities. This represents a dynamic, large-scale combinatorial optimization problem with an exponentially large solution space, further complicated by real-time disruptions (breakdowns, weather, rolling stock delays). Human intuition alone is no longer sufficient; intelligent decision-support tools are required to improve precision, scalability, and responsiveness.

## Expected Solution
An intelligent decision-support system that assists section controllers in making optimized, real-time decisions for train precedence and crossings. The system should:
- Leverage operations research and AI to model constraints, train priorities, and operational rules, producing conflict-free, feasible schedules dynamically.
- Maximize section throughput and minimize overall train travel time, with the ability to re-optimize rapidly under disruptions (e.g., incidents, delays, weather).
- Support what-if simulation and scenario analysis to evaluate alternative routings, holding strategies, and platform allocations.
- Provide a user-friendly interface for controllers with clear recommendations, explanations, and override capabilities.
- Integrate with existing railway control systems and data sources (signalling, TMS, timetables, rolling stock status) via secure APIs.
- Include audit trails, performance dashboards, and KPIs (punctuality, average delay, throughput, utilization) for continuous improvement.

---

# Solution Architecture

## Repository Structure
```
scengen-trubo/
├── apps/
│   ├── server/
│   │   ├── index.js
│   │   ├── TrainScheduler/
│   │   │   ├── dynamic_schedule.json
│   │   │   ├── i+o.json
│   │   │   ├── output.json
│   │   │   ├── sample_train_data.json
│   │   │   ├── train_data.json
│   │   │   ├── train_schedule_output_summary.json
│   │   │   ├── train_schedule_output.json
│   │   │   ├── V2.py
│   │   │   └── V3.py
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── lib/
│       │   └── public/
│       ├── package.json
│       └── ...
├── packages/
│   ├── eslint-config/
│   ├── typescript-config/
│   └── ui/
├── package.json
├── turbo.json
└── README.md
```

## Flow & Approach

- **Simulation Engine:**
	- The core simulation is handled in the server (`apps/server/TrainScheduler/`).
	- Uses Mixed Integer Linear Programming (MILP) for optimal train scheduling and section throughput maximization.
	- Accepts train data and network configuration in JSON format (see `train_data.json`, `sample_train_data.json`).
	- Generates output schedules and summaries (`train_schedule_output.json`, `train_schedule_output_summary.json`).
	- Python scripts (`V2.py`, `V3.py`) implement the optimization logic and simulation routines.

- **Web Interface:**
	- Built with Next.js (`apps/web/`).
	- Provides a user-friendly UI for uploading train/network data, running simulations, and visualizing results.
	- Supports importing custom JSON files for simulation scenarios.
	- Displays recommendations, KPIs, and allows scenario analysis.

- **Extensibility:**
	- Modular structure allows integration with real railway control systems via APIs.
	- Easily extendable to support new data formats, optimization models, and visualization components.

## How It Solves the Problem
- Automates train precedence and crossing decisions using AI and MILP.
- Handles real-time disruptions and re-optimizes schedules dynamically.
- Enables controllers to simulate various scenarios and strategies before implementation.
- Improves throughput, punctuality, and utilization of railway infrastructure.
- Provides actionable insights and dashboards for continuous improvement.

---

# Screenshots & Demo

## Live Demo
🚀 **Deployed Application:** [Add your deployment URL here]

## Project Screenshots

### Main Dashboard
![Main Dashboard](path/to/dashboard-screenshot.png)
*Description: Overview of the train traffic control dashboard showing real-time train positions and scheduling interface.*

### Simulation Interface
![Simulation Interface](path/to/simulation-screenshot.png)
*Description: Train scheduling simulation interface with MILP optimization controls and scenario analysis.*

### Results Visualization
![Results Visualization](path/to/results-screenshot.png)
*Description: Visualization of optimized train schedules, throughput metrics, and performance KPIs.*

### JSON Data Import
![Data Import](path/to/import-screenshot.png)
*Description: Interface for importing custom train data and network configuration in JSON format.*

---

# Getting Started

## Prerequisites
- Node.js, npm
- Python 3.x (for MILP simulation)
- Install dependencies in both `apps/web` and `apps/server`:
	```bash
	cd apps/web && npm install
	cd ../server && npm install
	```

## Running the Simulation
1. Prepare your train/network data in JSON format (see sample files in `TrainScheduler/`).
2. Start the server:
	 ```bash
	 cd apps/server
	 node index.js
	 ```
3. Start the web interface:
	 ```bash
	 cd ../web
	 npm run dev
	 ```
4. Access the UI in your browser, upload your data, and run simulations.

## Customization
- Modify or add new JSON files in `TrainScheduler/` for different scenarios.
- Extend Python scripts for advanced optimization models.
- Customize UI components in `apps/web/src/components/`.

---

# Contributing
- Fork the repo, create a feature branch, and submit pull requests.
- See `packages/` for shared configs and UI components.

# Contact
For questions or demo requests, contact [Your Team Name/Email].
