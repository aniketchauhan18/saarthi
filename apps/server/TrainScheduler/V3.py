"""
Enhanced Dynamic Headway Train Scheduling Optimization Model V2
Combines dynamic headway logic with single comprehensive output file
- Uses headway values from train data file
- Single output.json file instead of multiple files
- Dynamic headway calculation based on relative velocities
- Comprehensive output with train info, schedules, and summaries

Author: Enhanced Dynamic Headway Version V2 - Single Output
Date: Sep 24, 2025
"""

import pulp
from pulp import LpMinimize, LpVariable, LpProblem, lpSum, LpStatus, value
import json
from pathlib import Path
import sys
from datetime import datetime
from collections import deque

class EnhancedDynamicHeadwayTrainScheduler:
    def __init__(self, data_file='train_data.json'):
        """Initialize the train scheduler with data from file."""
        self.load_data(data_file)
        self.model = None
        self.selected = {}
        self.tin = {}
        self.tout = {}
        self.completion_time = {}
        self.train_stopped = {}
        self.order_on_section = {}
        self.safe_separation_time = {}
        
    def load_data(self, data_file):
        """Load data from JSON file and calculate priorities."""
        try:
            with open(data_file, 'r') as f:
                data = json.load(f)
            
            # Extract data from JSON
            self.nb_stations = data['nb_stations']
            self.stations = range(1, self.nb_stations + 1)
            self.station_names = {int(k): v for k, v in data['station_names'].items()}
            
            self.nb_sections = data['nb_sections']
            self.sections = range(1, self.nb_sections + 1)
            
            self.nb_trains = data['nb_trains']
            self.trains = range(1, self.nb_trains + 1)
            
            self.sec_from = {int(k): v for k, v in data['sec_from'].items()}
            self.sec_to = {int(k): v for k, v in data['sec_to'].items()}
            self.sec_dist = {int(k): v for k, v in data['sec_dist'].items()}
            self.sec_vmax = {int(k): v for k, v in data['sec_vmax'].items()}
            
            self.allowed_sections = {}
            for t, sections in data['allowed_sections'].items():
                self.allowed_sections[int(t)] = {int(s): v for s, v in sections.items()}
            
            self.start_station = {int(k): v for k, v in data['start_station'].items()}
            self.end_station = {int(k): v for k, v in data['end_station'].items()}
            self.train_vmax = {int(k): v for k, v in data['train_vmax'].items()}
            
            # Load headway data from file (if available)
            if 'headway' in data:
                if isinstance(data['headway'], dict):
                    # Per-train headway values
                    self.train_headway = {int(k): v for k, v in data['headway'].items()}
                    self.min_headway = min(self.train_headway.values())
                    print(f"Using per-train headway values from file (min: {self.min_headway} minutes)")
                else:
                    # Single headway value for all trains
                    headway_value = data['headway']
                    self.train_headway = {t: headway_value for t in self.trains}
                    self.min_headway = headway_value
                    print(f"Using single headway value from file: {headway_value} minutes for all trains")
            else:
                # Fallback to default headway values
                self.train_headway = {t: 1.0 for t in self.trains}
                self.min_headway = 1.0
                print("No headway data in file, using default 1.0 minutes")
            
            # Safety parameters for dynamic headway
            self.safety_margin = 1.5  # Additional safety factor
            self.BIG_M = 10000
            
            # Calculate train paths and info
            self.train_info = self._calculate_train_info()
            self.train_section_speeds = self._calculate_section_speeds()
            
            # Identify trains with no valid paths
            self.trains_with_paths = [t for t in self.trains if self.train_info[t]['has_valid_path']]
            self.trains_without_paths = [t for t in self.trains if not self.train_info[t]['has_valid_path']]
            
            print(f"Data loaded successfully from {data_file}")
            print(f"Trains with valid paths: {len(self.trains_with_paths)}/{self.nb_trains}")
            print(f"Trains without valid paths (will be stopped): {self.trains_without_paths}")
            print(f"Dynamic headway parameters: Min={self.min_headway}min, Safety={self.safety_margin}")
            
        except FileNotFoundError:
            print(f"Error: Data file '{data_file}' not found!")
            sys.exit(1)
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON format in '{data_file}'!")
            sys.exit(1)
    
    def _find_train_path(self, train):
        """Find the path using BFS to ensure shortest valid path."""
        start = self.start_station[train]
        end = self.end_station[train]
        
        # BFS to find shortest path
        queue = deque([(start, [])])
        visited = set()
        
        while queue:
            current_station, path = queue.popleft()
            
            if current_station == end:
                return path
            
            if current_station in visited:
                continue
            visited.add(current_station)
            
            # Find all valid next sections
            for s in self.sections:
                if (self.allowed_sections[train][s] == 1 and 
                    self.sec_from[s] == current_station):
                    next_station = self.sec_to[s]
                    if next_station not in visited:
                        queue.append((next_station, path + [s]))
        
        # No valid path found
        return []
    
    def _calculate_train_info(self):
        """Calculate train information including paths and travel times."""
        train_info = {}
        
        print("\nFinding valid paths for trains...")
        
        for t in self.trains:
            path = self._find_train_path(t)
            
            if path:
                # Calculate travel time for valid path
                total_time = 0
                total_distance = 0
                
                for s in path:
                    distance = self.sec_dist[s]
                    max_speed = min(self.train_vmax[t], self.sec_vmax[s])
                    travel_time = (distance / max_speed) * 60  # minutes
                    total_time += travel_time
                    total_distance += distance
                
                avg_speed = total_distance / (total_time / 60) if total_time > 0 else 0
                
                train_info[t] = {
                    'path': path,
                    'has_valid_path': True,
                    'base_travel_time': total_time,
                    'total_distance': total_distance,
                    'avg_speed': avg_speed,
                    'max_speed': self.train_vmax[t],
                    'priority': self.train_vmax[t] / len(path) if len(path) > 0 else 0,
                    'path_length': len(path),
                    'headway': self.train_headway[t]
                }
                
                route_str = f"{self.station_names[self.start_station[t]]} -> {self.station_names[self.end_station[t]]}"
                print(f"   Train {t}: Valid path found - {route_str} ({len(path)} sections, {total_time:.1f} min)")
                
            else:
                # No valid path exists
                train_info[t] = {
                    'path': [],
                    'has_valid_path': False,
                    'base_travel_time': 0,
                    'total_distance': 0,
                    'avg_speed': 0,
                    'max_speed': self.train_vmax[t],
                    'priority': 0,
                    'path_length': 0,
                    'headway': self.train_headway[t]
                }
                
                route_str = f"{self.station_names[self.start_station[t]]} -> {self.station_names[self.end_station[t]]}"
                print(f"   Train {t}: NO VALID PATH - {route_str}")
        
        return train_info
    
    def _calculate_section_speeds(self):
        """Calculate actual speeds for each train on each section."""
        speeds = {}
        for t in self.trains:
            speeds[t] = {}
            for s in self.sections:
                # Actual speed is minimum of train max speed and section max speed
                speeds[t][s] = min(self.train_vmax[t], self.sec_vmax[s])
        return speeds
    
    def _calculate_dynamic_headway(self, train1, train2, section):
        """
        Calculate dynamic headway based on relative speeds and train-specific headway values.
        Uses the maximum headway requirement of both trains for safety.
        """
        speed1 = self.train_section_speeds[train1][section]
        speed2 = self.train_section_speeds[train2][section]
        section_length = self.sec_dist[section]
        
        # Use maximum headway requirement from both trains
        base_headway = max(self.train_headway[train1], self.train_headway[train2])
        
        if speed1 >= speed2:
            # Train ahead is faster or same speed - safe with base headway
            return base_headway
        else:
            # Train ahead is slower - need larger separation
            # Time for train1 to clear the section
            train1_clear_time = (section_length / speed1) * 60  # minutes
            
            # Relative speed (train2 catching up to train1)
            relative_speed = speed2 - speed1  # km/h
            
            # Time it would take train2 to catch train1 if they started together
            catch_up_time = (section_length / relative_speed) * 60 if relative_speed > 0 else self.BIG_M
            
            # Safe headway: ensure train2 enters after train1 has enough lead
            # We want train1 to clear before train2 catches up
            safe_headway = max(
                base_headway,
                train1_clear_time * self.safety_margin / (speed2 / speed1)
            )
            
            return min(safe_headway, train1_clear_time)
    
    def create_model(self):
        """Create the optimization model with dynamic headway constraints."""
        print("\n" + "="*60)
        print("CREATING ENHANCED DYNAMIC HEADWAY OPTIMIZATION MODEL")
        print("="*60)
        
        self.model = LpProblem("Enhanced_Dynamic_Headway_Train_Scheduling", LpMinimize)
        
        # Create decision variables
        self._create_variables()
        
        # Set objective function
        self._set_objective()
        
        # Add constraints
        self._add_constraints()
        
        print("Model creation completed with dynamic headway logic")
    
    def _create_variables(self):
        """Create decision variables."""
        print("Creating decision variables...")
        
        # Binary: 1 if train t uses section s
        for t in self.trains:
            for s in self.sections:
                self.selected[t, s] = LpVariable(f"selected_{t}_{s}", cat='Binary')
        
        # Binary: 1 if train t is stopped
        for t in self.trains:
            self.train_stopped[t] = LpVariable(f"stopped_{t}", cat='Binary')
        
        # Continuous: entrance and exit times
        for t in self.trains:
            for s in self.sections:
                self.tin[t, s] = LpVariable(f"tin_{t}_{s}", lowBound=0)
                self.tout[t, s] = LpVariable(f"tout_{t}_{s}", lowBound=0)
        
        # Continuous: completion time for each train
        for t in self.trains:
            self.completion_time[t] = LpVariable(f"completion_{t}", lowBound=0)
        
        # Binary: ordering variables on sections
        for s in self.sections:
            for t1 in self.trains:
                for t2 in self.trains:
                    if t1 < t2:
                        self.order_on_section[t1, t2, s] = LpVariable(
                            f"order_{t1}_{t2}_{s}", cat='Binary'
                        )
        
        # Continuous: safe separation time between trains
        for s in self.sections:
            for t1 in self.trains:
                for t2 in self.trains:
                    if t1 != t2:
                        self.safe_separation_time[t1, t2, s] = LpVariable(
                            f"safe_sep_{t1}_{t2}_{s}", lowBound=0
                        )
    
    def _set_objective(self):
        """Set objective function."""
        print("Setting objective function...")
        
        # Primary: minimize total completion time
        total_completion = lpSum(self.completion_time[t] for t in self.trains)
        
        # Secondary: penalty for stopping trains
        stopping_penalty = lpSum(1000 * self.train_stopped[t] for t in self.trains)
        
        # Tertiary: favor faster trains going first on shared sections
        speed_priority_bonus = lpSum(
            -0.001 * self.train_vmax[t1] * self.order_on_section[t1, t2, s]
            for s in self.sections
            for t1 in self.trains
            for t2 in self.trains
            if t1 < t2 and t1 in self.trains_with_paths and t2 in self.trains_with_paths 
            and s in self.train_info[t1]['path'] and s in self.train_info[t2]['path']
            and self.train_vmax[t1] > self.train_vmax[t2]
        )
        
        self.model += (total_completion + stopping_penalty + speed_priority_bonus), "Minimize_Total_Time"
    
    def _add_constraints(self):
        """Add constraints with dynamic headway logic."""
        print("Adding constraints with dynamic headway logic...")
        
        # CRITICAL: Force trains without valid paths to be stopped
        for t in self.trains_without_paths:
            self.model += self.train_stopped[t] == 1, f"Force_stop_no_path_{t}"
        
        # For trains WITH valid paths, enforce they use ONLY their valid path sections
        for t in self.trains_with_paths:
            valid_path = self.train_info[t]['path']
            
            # Train must use ALL sections in its valid path (if not stopped)
            for s in valid_path:
                self.model += (
                    self.selected[t, s] >= (1 - self.train_stopped[t]),
                    f"Must_use_path_section_{t}_{s}"
                )
            
            # Train CANNOT use sections NOT in its valid path
            for s in self.sections:
                if s not in valid_path:
                    self.model += self.selected[t, s] == 0, f"Cannot_use_non_path_{t}_{s}"
        
        # For trains without paths, they cannot use any sections
        for t in self.trains_without_paths:
            for s in self.sections:
                self.model += self.selected[t, s] == 0, f"No_sections_for_stopped_{t}_{s}"
        
        # Travel time constraints using actual section speeds
        for t in self.trains_with_paths:
            for s in self.train_info[t]['path']:
                travel_time = (self.sec_dist[s] / self.train_section_speeds[t][s]) * 60
                self.model += (
                    self.tout[t, s] >= self.tin[t, s] + travel_time * self.selected[t, s],
                    f"Travel_{t}_{s}"
                )
        
        # Continuity constraints for valid paths
        for t in self.trains_with_paths:
            path = self.train_info[t]['path']
            for i in range(len(path) - 1):
                curr_section = path[i]
                next_section = path[i + 1]
                self.model += (
                    self.tin[t, next_section] >= self.tout[t, curr_section],
                    f"Continuity_{t}_{curr_section}_{next_section}"
                )
        
        # Start time for first section
        for t in self.trains_with_paths:
            if self.train_info[t]['path']:
                first_section = self.train_info[t]['path'][0]
                self.model += self.tin[t, first_section] >= 0, f"Start_time_{t}"
        
        # Completion time calculation
        for t in self.trains_with_paths:
            if self.train_info[t]['path']:
                last_section = self.train_info[t]['path'][-1]
                self.model += (
                    self.completion_time[t] == self.tout[t, last_section],
                    f"Completion_{t}"
                )
        
        for t in self.trains_without_paths:
            self.model += self.completion_time[t] == 0, f"No_completion_stopped_{t}"
        
        # DYNAMIC HEADWAY CONSTRAINTS for each section
        for s in self.sections:
            trains_using = [t for t in self.trains_with_paths 
                          if s in self.train_info[t]['path']]
            
            for i, t1 in enumerate(trains_using):
                for t2 in trains_using[i+1:]:
                    # Calculate dynamic headways for both orderings
                    headway_t1_first = self._calculate_dynamic_headway(t1, t2, s)
                    headway_t2_first = self._calculate_dynamic_headway(t2, t1, s)
                    
                    # Set safe separation times based on who goes first
                    self.model += self.safe_separation_time[t1, t2, s] >= headway_t1_first
                    self.model += self.safe_separation_time[t2, t1, s] >= headway_t2_first
                    
                    # Ordering constraints with dynamic headway
                    # If t1 goes first (order = 1)
                    self.model += (
                        self.tin[t2, s] >= self.tin[t1, s] + self.safe_separation_time[t1, t2, s] 
                        - self.BIG_M * (1 - self.order_on_section[min(t1,t2), max(t1,t2), s]),
                        f"Dynamic_order1_{s}_{t1}_{t2}"
                    )
                    
                    # If t2 goes first (order = 0)
                    self.model += (
                        self.tin[t1, s] >= self.tin[t2, s] + self.safe_separation_time[t2, t1, s]
                        - self.BIG_M * self.order_on_section[min(t1,t2), max(t1,t2), s],
                        f"Dynamic_order2_{s}_{t1}_{t2}"
                    )
                    
                    # Additional safety: ensure faster train can overtake if needed
                    if self.train_section_speeds[t1][s] > self.train_section_speeds[t2][s]:
                        # If slower train (t2) enters first, ensure enough gap for faster train
                        clear_time = (self.sec_dist[s] / self.train_section_speeds[t2][s]) * 60
                        self.model += (
                            self.tin[t1, s] >= self.tin[t2, s] + clear_time * 0.8
                            - self.BIG_M * self.order_on_section[min(t1,t2), max(t1,t2), s],
                            f"Overtake_safety_{s}_{t1}_{t2}"
                        )
        
        # Bound unused variables
        for t in self.trains:
            for s in self.sections:
                if t in self.trains_without_paths or (t in self.trains_with_paths and s not in self.train_info[t]['path']):
                    self.model += self.tin[t, s] == 0, f"Zero_tin_{t}_{s}"
                    self.model += self.tout[t, s] == 0, f"Zero_tout_{t}_{s}"
                    
        # STATION COLLISION PREVENTION
        station_min_separation = 2.0  # Minimum 2 minutes between station events
        
        for station_id in self.stations:
            # Find all trains that pass through this station
            trains_at_station = []
            for t in self.trains_with_paths:
                path = self.train_info[t]['path']
                for s in path:
                    if self.sec_to[s] == station_id:  # Train arrives at this station
                        trains_at_station.append((t, s, 'arrival'))
                    if self.sec_from[s] == station_id:  # Train departs from this station  
                        trains_at_station.append((t, s, 'departure'))
            
            # Add separation constraints between all pairs of events at this station
            for i, (t1, s1, event1) in enumerate(trains_at_station):
                for j, (t2, s2, event2) in enumerate(trains_at_station):
                    if i < j:  # Avoid duplicate constraints
                        # Create unique constraint names using event indices
                        constraint_id = f"{station_id}_{i}_{j}"
                        
                        # Create binary variable for ordering at station
                        station_order_var = LpVariable(f"station_order_{constraint_id}", cat='Binary')
                        
                        # Get event times based on arrival/departure
                        if event1 == 'arrival':
                            time1 = self.tout[t1, s1]
                        else:  # departure
                            time1 = self.tin[t1, s1]
                            
                        if event2 == 'arrival':
                            time2 = self.tout[t2, s2]
                        else:  # departure
                            time2 = self.tin[t2, s2]
                        
                        # Ensure minimum separation: either t1 then t2, or t2 then t1
                        self.model += (
                            time2 >= time1 + station_min_separation 
                            - self.BIG_M * (1 - station_order_var),
                            f"Station_sep1_{constraint_id}"
                        )
                        self.model += (
                            time1 >= time2 + station_min_separation 
                            - self.BIG_M * station_order_var,
                            f"Station_sep2_{constraint_id}"
                        )
    
    def solve(self):
        """Solve the optimization model."""
        print("\n" + "="*60)
        print("SOLVING ENHANCED DYNAMIC HEADWAY OPTIMIZATION MODEL")
        print("="*60)
        
        solver = pulp.PULP_CBC_CMD(msg=1, timeLimit=120)
        status = self.model.solve(solver)
        
        return status
    
    def display_results(self, status):
        """Display comprehensive results."""
        print("\n" + "="*60)
        print("OPTIMIZATION RESULTS")
        print("="*60)
        
        status_str = LpStatus[status]
        print(f"\nStatus: {status_str}")
        
        if status != 1:  # Not optimal
            print("\nNo optimal solution found!")
            return
        
        print("\nOptimal solution found with dynamic headway!")
        
        # Calculate metrics
        running_trains = [t for t in self.trains if (value(self.train_stopped[t]) or 0) < 0.01]
        stopped_trains = [t for t in self.trains if (value(self.train_stopped[t]) or 0) >= 0.99]
        
        total_completion = sum(value(self.completion_time[t]) or 0 for t in running_trains)
        avg_completion = total_completion / len(running_trains) if running_trains else 0
        
        total_delay = sum((value(self.completion_time[t]) or 0) - self.train_info[t]['base_travel_time'] 
                         for t in running_trains if self.train_info[t]['has_valid_path'])
        avg_delay = total_delay / len(running_trains) if running_trains else 0
        
        print(f"\nTOTAL COMPLETION TIME: {total_completion:.2f} minutes")
        print(f"AVERAGE COMPLETION TIME: {avg_completion:.2f} minutes")
        print(f"TOTAL DELAY: {total_delay:.2f} minutes")
        print(f"AVERAGE DELAY: {avg_delay:.2f} minutes")
        print(f"RUNNING TRAINS: {len(running_trains)}/{self.nb_trains}")
        print(f"STOPPED TRAINS: {len(stopped_trains)}")
        
        # Display train schedules
        self._display_train_schedules()
    
    def _display_train_schedules(self):
        """Display train schedules for running trains."""
        print("\nTRAIN SCHEDULES")
        print("-" * 60)
        
        running_trains = [t for t in self.trains if (value(self.train_stopped[t]) or 0) < 0.01]
        
        for t in sorted(running_trains):
            if self.train_info[t]['has_valid_path']:
                completion = value(self.completion_time[t]) or 0
                base_time = self.train_info[t]['base_travel_time']
                delay = completion - base_time
                headway = self.train_info[t]['headway']
                
                print(f"\nTrain {t}: {self.station_names[self.start_station[t]]} -> {self.station_names[self.end_station[t]]}")
                print(f"Max Speed: {self.train_vmax[t]} km/h | Headway: {headway} min | Completion: {completion:.2f} min | Delay: {delay:+.1f} min")
                
                path = self.train_info[t]['path']
                for s in path:
                    tin_val = value(self.tin[t, s]) or 0
                    tout_val = value(self.tout[t, s]) or 0
                    speed = self.train_section_speeds[t][s]
                    route_name = f"{self.station_names[self.sec_from[s]]} -> {self.station_names[self.sec_to[s]]}"
                    
                    print(f"   Section {s}: {route_name} | Entry: {tin_val:.2f} | Exit: {tout_val:.2f} | Speed: {speed:.0f} km/h")
    
    def save_results_to_json(self, status, filename="output.json"):
        """Save complete scheduling results to a single JSON file."""
        print(f"\nSaving results to {filename}...")
        
        if status != 1:
            print("Cannot save results - no optimal solution found")
            return
        
        # Calculate performance metrics
        running_trains = [t for t in self.trains if (value(self.train_stopped[t]) or 0) < 0.01]
        stopped_trains = [t for t in self.trains if (value(self.train_stopped[t]) or 0) >= 0.99]
        
        total_completion = sum(value(self.completion_time[t]) or 0 for t in running_trains)
        avg_completion = total_completion / len(running_trains) if running_trains else 0
        total_delay = sum((value(self.completion_time[t]) or 0) - self.train_info[t]['base_travel_time'] 
                         for t in running_trains)
        avg_delay = total_delay / len(running_trains) if running_trains else 0
        
        # Prepare the output data structure
        output_data = {
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "solver_status": LpStatus[status],
                "model_type": "Dynamic Headway Scheduling",
                "min_headway_minutes": self.min_headway,
                "safety_margin": self.safety_margin,
                "total_trains": self.nb_trains,
                "total_sections": self.nb_sections,
                "total_stations": self.nb_stations
            },
            "performance_metrics": {
                "total_completion_time_minutes": round(total_completion, 2),
                "average_completion_time_minutes": round(avg_completion, 2),
                "total_delay_minutes": round(total_delay, 2),
                "average_delay_minutes": round(avg_delay, 2),
                "running_trains_count": len(running_trains),
                "stopped_trains_count": len(stopped_trains),
                "success_rate_percent": round((len(running_trains) / self.nb_trains) * 100, 1)
            },
            "stations": {
                str(k): v for k, v in self.station_names.items()
            },
            "sections": {
                str(s): {
                    "from_station": self.sec_from[s],
                    "to_station": self.sec_to[s],
                    "from_station_name": self.station_names[self.sec_from[s]],
                    "to_station_name": self.station_names[self.sec_to[s]],
                    "distance_km": self.sec_dist[s],
                    "max_speed_kmh": self.sec_vmax[s]
                } for s in self.sections
            },
            "train_results": {},
            "section_usage": {},
            "timeline_events": []
        }
        
        # Process each train
        for t in self.trains:
            stopped_val = value(self.train_stopped[t]) or 0
            completion_val = value(self.completion_time[t]) or 0
            
            train_data = {
                "train_id": t,
                "start_station": self.start_station[t],
                "end_station": self.end_station[t],
                "start_station_name": self.station_names[self.start_station[t]],
                "end_station_name": self.station_names[self.end_station[t]],
                "max_speed_kmh": self.train_vmax[t],
                "headway_minutes": self.train_headway[t],
                "priority_score": round(self.train_info[t]['priority'], 3),
                "base_travel_time_minutes": round(self.train_info[t]['base_travel_time'], 2),
                "is_stopped": stopped_val >= 0.99,
                "actual_completion_time_minutes": round(completion_val, 2) if stopped_val < 0.99 else None,
                "delay_minutes": round(completion_val - self.train_info[t]['base_travel_time'], 2) if stopped_val < 0.99 else None,
                "path_sections": self.train_info[t]['path'],
                "schedule": []
            }
            
            # Add detailed schedule for running trains
            if stopped_val < 0.99:
                for s in self.train_info[t]['path']:
                    selected_val = value(self.selected[t, s]) or 0
                    if selected_val >= 0.99:
                        tin_val = value(self.tin[t, s]) or 0
                        tout_val = value(self.tout[t, s]) or 0
                        
                        train_data["schedule"].append({
                            "section_id": s,
                            "from_station": self.sec_from[s],
                            "to_station": self.sec_to[s],
                            "from_station_name": self.station_names[self.sec_from[s]],
                            "to_station_name": self.station_names[self.sec_to[s]],
                            "distance_km": self.sec_dist[s],
                            "actual_speed_kmh": self.train_section_speeds[t][s],
                            "entry_time_minutes": round(tin_val, 3),
                            "exit_time_minutes": round(tout_val, 3),
                            "travel_time_minutes": round(tout_val - tin_val, 3)
                        })
            
            output_data["train_results"][str(t)] = train_data
        
        # Section usage analysis
        for s in self.sections:
            trains_using = []
            train_schedules = []
            
            for t in self.trains:
                selected_val = value(self.selected[t, s]) or 0
                stopped_val = value(self.train_stopped[t]) or 0
                if (selected_val >= 0.99 and stopped_val < 0.01):
                    trains_using.append(t)
                    
                    tin_val = value(self.tin[t, s]) or 0
                    tout_val = value(self.tout[t, s]) or 0
                    train_schedules.append({
                        "train_id": t,
                        "entry_time_minutes": round(tin_val, 3),
                        "exit_time_minutes": round(tout_val, 3),
                        "speed_kmh": self.train_section_speeds[t][s],
                        "headway_minutes": self.train_headway[t]
                    })
            
            # Sort by entry time and analyze headways
            train_schedules.sort(key=lambda x: x["entry_time_minutes"])
            
            headway_analysis = []
            for i in range(len(train_schedules) - 1):
                t1_data = train_schedules[i]
                t2_data = train_schedules[i + 1]
                
                actual_gap = t2_data["entry_time_minutes"] - t1_data["entry_time_minutes"]
                required_headway = self._calculate_dynamic_headway(t1_data["train_id"], t2_data["train_id"], s)
                
                headway_analysis.append({
                    "first_train": t1_data["train_id"],
                    "second_train": t2_data["train_id"],
                    "actual_gap_minutes": round(actual_gap, 3),
                    "required_headway_minutes": round(required_headway, 3),
                    "is_safe": actual_gap >= required_headway - 0.01,
                    "first_speed": t1_data["speed_kmh"],
                    "second_speed": t2_data["speed_kmh"],
                    "first_headway": t1_data["headway_minutes"],
                    "second_headway": t2_data["headway_minutes"]
                })
            
            output_data["section_usage"][str(s)] = {
                "section_id": s,
                "from_station": self.sec_from[s],
                "to_station": self.sec_to[s],
                "route_name": f"{self.station_names[self.sec_from[s]]} -> {self.station_names[self.sec_to[s]]}",
                "distance_km": self.sec_dist[s],
                "max_speed_kmh": self.sec_vmax[s],
                "trains_using": trains_using,
                "utilization_count": len(trains_using),
                "train_schedules": train_schedules,
                "headway_analysis": headway_analysis
            }
        
        # Timeline events for simulation
        events = []
        for t in self.trains:
            stopped_val = value(self.train_stopped[t]) or 0
            if stopped_val < 0.01:
                for s in self.sections:
                    selected_val = value(self.selected[t, s]) or 0
                    if selected_val >= 0.99:
                        tin_val = value(self.tin[t, s]) or 0
                        tout_val = value(self.tout[t, s]) or 0
                        speed = self.train_section_speeds[t][s]
                        
                        # Departure event
                        events.append({
                            "time_minutes": round(tin_val, 3),
                            "train_id": t,
                            "station_id": self.sec_from[s],
                            "station_name": self.station_names[self.sec_from[s]],
                            "section_id": s,
                            "event_type": "departure",
                            "speed_kmh": speed,
                            "headway_minutes": self.train_headway[t]
                        })
                        
                        # Arrival event
                        events.append({
                            "time_minutes": round(tout_val, 3),
                            "train_id": t,
                            "station_id": self.sec_to[s],
                            "station_name": self.station_names[self.sec_to[s]],
                            "section_id": s,
                            "event_type": "arrival",
                            "speed_kmh": speed,
                            "headway_minutes": self.train_headway[t]
                        })
        
        # Sort events by time
        events.sort(key=lambda x: x["time_minutes"])
        output_data["timeline_events"] = events
        
        # Save to JSON file
        try:
            with open(filename, 'w') as f:
                json.dump(output_data, f, indent=2, ensure_ascii=False)
            print(f"Results saved successfully to {filename}")
            
        except Exception as e:
            print(f"Error saving results: {e}")


def main():
    """Main execution function."""
    print("Enhanced Dynamic Headway Train Scheduling Optimization System V2")
    print("Using headway values from train data + Single output.json file")
    print("=" * 70)
    
    # Create enhanced dynamic scheduler
    scheduler = EnhancedDynamicHeadwayTrainScheduler('train_data.json')
    
    # Create and solve model
    scheduler.create_model()
    status = scheduler.solve()
    
    # Display results
    scheduler.display_results(status)
    
    # Save results to single output.json file
    scheduler.save_results_to_json(status)

if __name__ == "__main__":
    main()