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

## Why MILP Optimization Makes Our Solution Unique

### Traditional vs. Our Approach

**Traditional Solutions:**
- **Rule-based systems:** Use predefined heuristics and first-come-first-served approaches
- **Greedy algorithms:** Make locally optimal choices without considering global impact
- **Simulation-only tools:** Can model scenarios but cannot guarantee optimal solutions
- **Manual decision-making:** Relies heavily on controller experience and intuition

**Our MILP-Powered Solution:**
- **Mathematical Optimization:** Uses Mixed Integer Linear Programming to find provably optimal solutions
- **Global Optimization:** Considers all constraints simultaneously to maximize overall throughput
- **Exact Solutions:** Guarantees the best possible schedule given the constraints
- **Scalable Framework:** Can handle large-scale networks with hundreds of trains and constraints

### The Mathematics Behind Train Scheduling Optimization

Our MILP model formulates the train scheduling problem using rigorous mathematical optimization:

#### **Decision Variables:**
```
x_{i,j,t} ∈ {0,1}  : Binary variable = 1 if train i uses track section j at time t
y_{i,t} ∈ {0,1}    : Binary variable = 1 if train i departs at time t  
d_i ≥ 0           : Continuous variable for delay of train i
s_{i,k} ∈ {0,1}   : Binary variable = 1 if train i uses platform k
```

#### **Objective Function:**
```
Maximize: Σ(w_i × (1 - d_i/T_max)) - α×Σ(d_i) + β×Σ(x_{i,j,t})
          i                          i        i,j,t
```
Where:
- `w_i` = Priority weight of train i
- `d_i` = Delay of train i from scheduled time
- `T_max` = Maximum allowable delay
- `α, β` = Penalty and throughput coefficients

#### **Mathematical Constraints:**

**1. Track Capacity Constraints:**
```
Σ x_{i,j,t} ≤ 1    ∀j,t  (Only one train per track section per time)
i
```

**2. Safety Headway Constraints:**
```
x_{i,j,t} + x_{k,j,t'} ≤ 1    ∀i≠k, j, |t-t'| ≤ h_min
```
Where `h_min` is minimum headway time between trains.

**3. Train Flow Conservation:**
```
Σ x_{i,j,t} = Σ x_{i,j',t+τ_{j,j'}}    ∀i (trains must move continuously)
j            j'
```

**4. Platform Assignment Constraints:**
```
Σ s_{i,k} = 1      ∀i  (Each train assigned exactly one platform)
k

Σ s_{i,k} ≤ 1      ∀k,t  (Each platform serves max one train at time t)
i∈T_t
```

**5. Priority Ordering Constraints:**
```
If Priority(i) > Priority(j), then:
Σ t×y_{i,t} ≤ Σ t×y_{j,t} + M×(1-z_{i,j})
t            t
```
Where `M` is a big number and `z_{i,j}` enforces priority ordering.

**6. Junction Conflict Resolution:**
```
For conflicting paths P_i and P_j at junction:
x_{i,junction,t} + x_{j,junction,t'} ≤ 1    ∀|t-t'| ≤ clearance_time
```

**7. Delay Calculation:**
```
d_i ≥ Σ t×y_{i,t} - scheduled_time_i    ∀i
      t
d_i ≥ 0                                  ∀i
```

**8. Time Window Constraints:**
```
earliest_i ≤ Σ t×y_{i,t} ≤ latest_i    ∀i
             t
```

#### **MILP Solver Implementation:**
The system uses advanced branch-and-bound algorithms with:
- **Linear Programming Relaxation:** Solves continuous version first
- **Cutting Planes:** Adds valid inequalities to tighten bounds  
- **Heuristic Primal Solutions:** Finds good integer solutions quickly
- **Preprocessing:** Reduces problem size through constraint propagation

#### **Computational Complexity:**
- **Problem Size:** O(|T| × |J| × |Time_horizon|) variables
- **Constraint Count:** O(|T|² × |J| × |Time_horizon|)
- **Solution Method:** Branch-and-bound with intelligent node selection
- **Optimality Gap:** Configurable (typically 1-5% for real-time performance)

### What Makes Visualization the Most Difficult Part

**Complex Multi-dimensional Problem:**
- **Spatial Dimension:** Track layouts, junctions, platforms, signals
- **Temporal Dimension:** Real-time scheduling across multiple time horizons
- **Priority Dimension:** Different train types with varying importance levels
- **Constraint Visualization:** Showing safety buffers, capacity limits, conflict zones

**Our Visualization Solution:**
- **Interactive Network Maps:** Visual representation of track layouts and train positions
- **Gantt Chart Scheduling:** Time-based visualization of train movements and conflicts
- **Conflict Resolution Display:** Shows how MILP resolves scheduling conflicts
- **Performance Metrics Dashboard:** Real-time KPIs and throughput optimization results
- **Scenario Comparison:** Side-by-side visualization of different optimization outcomes

### How Our Solution Addresses the Problem Statement

**1. Replacing Manual Decision-Making:**
- **Problem:** Controllers rely on experience and intuition for complex decisions
- **Our Solution:** MILP provides mathematically optimal decisions with reasoning transparency

**2. Handling Scale and Complexity:**
- **Problem:** Exponentially large solution space with multiple constraints
- **Our Solution:** Advanced optimization algorithms efficiently explore solution space

**3. Real-time Adaptability:**
- **Problem:** Static schedules cannot adapt to disruptions
- **Our Solution:** Dynamic re-optimization capability handles real-time changes

**4. Maximizing Infrastructure Utilization:**
- **Problem:** Suboptimal use of limited track and platform resources
- **Our Solution:** MILP maximizes throughput while maintaining safety constraints

**5. Supporting Controller Decision-Making:**
- **Problem:** Need for intelligent decision-support tools
- **Our Solution:** Provides optimized recommendations with override capabilities and clear explanations

**6. Integration and Scalability:**
- **Problem:** Need for systems that work with existing railway infrastructure
- **Our Solution:** API-based architecture for seamless integration with TMS and signaling systems

### The Simulation Advantage

**Beyond Traditional Scheduling Tools:**
- **What-if Analysis:** Test multiple scenarios before implementation
- **Risk Assessment:** Evaluate impact of different disruption scenarios  
- **Performance Prediction:** Forecast throughput and delay metrics
- **Training Tool:** Allows controllers to practice with optimized recommendations
- **Validation Framework:** Verify optimization results before real-world deployment

This combination of mathematical rigor through MILP and intuitive visualization through simulation creates a powerful decision-support system that transforms how railway sections manage train traffic, moving from experience-based decisions to data-driven optimal solutions.

---

# Screenshots & Demo

## Live Demo
🚀 **Deployed Application:** https://saarthi-web.vercel.app

## Project Screenshots

### Main Dashboard
<img width="1879" height="860" alt="image" src="https://github.com/user-attachments/assets/3811fbdd-91bf-40c8-9209-5bee3bef0208" />

### Simulation Interface
<img width="1889" height="866" alt="image" src="https://github.com/user-attachments/assets/3f80cb57-9c69-422d-b289-1b97c4eb1c2e" />

### Results Visualization
<img width="1886" height="848" alt="image" src="https://github.com/user-attachments/assets/67e1f18e-207a-457b-8f99-1db9d9029db5" />
<img width="1886" height="852" alt="image" src="https://github.com/user-attachments/assets/49f2c13b-e62c-4f5a-80f5-65975b2289bd" />


## Project Screenshots

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
