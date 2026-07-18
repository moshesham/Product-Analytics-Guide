export interface Section {
  id: string;
  title: string;
  signal: string;
  code: string;
  extraText?: string;
}

export interface Part {
  id: string;
  title: string;
  sections: Section[];
}

export const intro =
  "We’ve pivoted the focus from lower-level data pipelines (infrastructure/Data Engineering) to Product Analytics, Analytics Engineering, and Event-Driven User Behavior Analysis. This guide focuses on the exact patterns tested in Senior Product/Data Analyst and Analytics Engineering interviews: querying analytical databases, handling messy client-side tracking data, writing advanced pandas algorithms (like Cohort Analysis and Conversion Funnels), telemetry validation, and building maintainable analytics metrics frameworks.";

export const playbookTips = [
  {
    title: "Focus on Idempotency",
    description:
      "If you re-run an analytics job for '2023-10-15', it must overwrite that date's target partition instead of appending duplicate metric logs. Talk about DELETE-then-INSERT or SQL merge patterns.",
  },
  {
    title: "Handle Null Tracking Fields Gracefully",
    description:
      "When calculating user churn or funnel progress, always mention how you handle anonymous user profiles or missing tracking property values (df['utm_source'].fillna('organic')).",
  },
  {
    title: "Decouple Logic from Airflow",
    description:
      "Make sure to highlight that you keep your analytical formulas (like LTV calculations) in structured, importable Python packages. Use Airflow purely to orchestrate and execute those packages.",
  },
];

export const parts: Part[] = [
  {
    id: "part-1",
    title: "Part 1: Analytics Connectivity & Telemetry Validation",
    sections: [
      {
        id: "sec-1",
        title: "1. Database Queries & Safe Metric Extraction (BigQuery / Snowflake Style)",
        signal:
          "When pulling raw event tables to calculate KPIs like Daily Active Users (DAU) or Session Durations, always use connection contexts and parameterized queries. Avoid SQL injection vulnerabilities when dynamically filtering dates.",
        code: `import pandas as pd
import sqlite3
import logging

logger = logging.getLogger(__name__)

def get_dau_and_sessions(conn: sqlite3.Connection, start_date: str, end_date: str) -> pd.DataFrame:
    """
    Retrieves daily active users (DAU) and total sessions safely.
    Demonstrates parameterization to avoid SQL Injection in metric pipelines.
    """
    # In production, this would hit Snowflake, BigQuery, or ClickHouse
    query = """
        SELECT 
            DATE(event_timestamp) AS activity_date,
            COUNT(DISTINCT user_id) AS daily_active_users,
            COUNT(DISTINCT session_id) AS total_sessions
        FROM client_events
        WHERE event_timestamp BETWEEN ? AND ?
        GROUP BY 1
        ORDER BY 1 ASC
    """
    try:
        # Pandas cleanly handles parameterized reads using SQL contexts
        df = pd.read_sql(query, conn, params=(start_date, end_date))
        logger.info(f"Retrieved active user metrics for range: {start_date} to {end_date}")
        return df
    except Exception as e:
        logger.error(f"Failed to query database: {e}")
        raise RuntimeError("Database query failure") from e`,
      },
      {
        id: "sec-1-practice",
        title: "Practice: Weekly Active Users (WAU)",
        signal:
          "WAU is often requested alongside DAU. Try modifying the previous query to group users by the week of their activity.",
        extraText: "Modify the query to calculate Weekly Active Users. In SQLite, you can use strftime('%Y-%W', event_timestamp) to extract the year and week. Return the cohort week and count of unique active users.",
        code: `import pandas as pd
import sqlite3

def get_wau(conn: sqlite3.Connection, start_date: str, end_date: str) -> pd.DataFrame:
    """
    Practice: Retrieve Weekly Active Users (WAU).
    """
    query = """
        SELECT 
            strftime('%Y-%W', event_timestamp) AS activity_week,
            COUNT(DISTINCT user_id) AS weekly_active_users
        FROM client_events
        WHERE event_timestamp BETWEEN ? AND ?
        GROUP BY 1
        ORDER BY 1 ASC
    """
    return pd.read_sql(query, conn, params=(start_date, end_date))`
      },
      {
        id: "sec-2",
        title: "2. Pulling Product Metrics from APIs (Amplitude / Mixpanel)",
        signal:
          "Product data is often pulled from third-party analytics platforms. These platforms enforce strict rate-limiting. Your code must handle 429 Too Many Requests using exponential backoff, define explicit timeouts, and handle pagination cleanly.",
        code: `import requests
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

class RateLimitException(Exception):
    """Custom exception raised when we hit API limits."""
    pass

# Automatically retries on rate limits with exponential backoff and jitter
@retry(
    wait=wait_exponential(multiplier=2, min=2, max=15),
    stop=stop_after_attempt(4),
    retry=retry_if_exception_type(RateLimitException)
)
def fetch_amplitude_events(api_url: str, api_key: str, start_time: str, timeout_sec: int = 10) -> dict:
    """Fetches event export logs from Amplitude with rate-limit resiliency."""
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {"start": start_time}
    
    try:
        response = requests.get(api_url, headers=headers, params=params, timeout=timeout_sec)
        
        if response.status_code == 429:
            raise RateLimitException("Amplitude API limit reached. Retrying...")
            
        response.raise_for_status() # Captures 4xx and 5xx errors
        return response.json()
        
    except requests.exceptions.Timeout as e:
        raise RuntimeError(f"API request timed out: {e}")
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Fatal API connection error: {e}")`,
      },
      {
        id: "sec-3",
        title: "3. Loading & Normalizing Nested S3 Telemetry (JSON Parsing)",
        signal:
          "Client-side tracking tools send events with deeply nested JSON attributes (e.g., custom properties inside event_properties). You need to know how to load these logs from S3 and flatten them into flat tables for analysis.",
        code: `import pandas as pd
import json
import io
import boto3

def load_and_normalize_telemetry(bucket_name: str, file_key: str) -> pd.DataFrame:
    """
    Loads nested JSON event logs from S3 and normalizes the nested event payloads.
    Resolves semi-structured data patterns commonly found in product telemetry.
    """
    s3_client = boto3.client('s3')
    response = s3_client.get_object(Bucket=bucket_name, Key=file_key)
    
    # Read the bytes object into memory and load as JSON objects
    raw_content = response['Body'].read().decode('utf-8')
    events = [json.loads(line) for line in raw_content.splitlines() if line.strip()]
    
    # Flatten nested dictionaries (e.g., properties.device_info -> device_info)
    df_flat = pd.json_normalize(
        events, 
        record_path=None, 
        meta=['event_name', 'user_id', 'timestamp', ['properties', 'platform'], ['properties', 'device_info']]
    )
    
    # Rename columns to a clean schema
    df_flat = df_flat.rename(columns={
        'properties.platform': 'platform',
        'properties.device_info': 'device_info'
    })
    
    return df_flat`,
      },
      {
        id: "sec-3-practice",
        title: "Practice: Handling Missing Schema Fields",
        signal:
          "When normalizing schema-less JSON tracking data, sometimes keys don't exist in all events. You must handle missing keys without throwing KeyError exceptions.",
        extraText: "Write a function to safely extract fields from parsed JSON logs. Provide a default value for missing fields.",
        code: `def safe_extract_properties(events: list) -> list:
    """
    Practice: Safely pull fields from semi-structured events, handling missing attributes.
    """
    normalized = []
    for event in events:
        props = event.get('properties', {})
        normalized.append({
            'user_id': event.get('user_id', 'anonymous'),
            'event_name': event.get('event_name', 'unknown_event'),
            'platform': props.get('platform', 'web'), # Default to web
            'version': props.get('app_version', None)
        })
    return normalized`
      },
      {
        id: "sec-4",
        title: "4. Structured Telemetry Validation Logging",
        signal:
          "A break in the product event schema ruins downstream models and metrics. Instead of generic print statements, implement schema-validation logging that alerts downstream systems if critical properties (like user_id or session_id) are null or structured incorrectly.",
        code: `import logging
import json

class TelemetryValidationFormatter(logging.Formatter):
    """Outputs structured diagnostic logs when telemetry events fail schema checks."""
    def format(self, record):
        log_payload = {
            "severity": record.levelname,
            "issue": record.getMessage(),
            "event_type": getattr(record, 'event_type', 'UNKNOWN'),
            "missing_field": getattr(record, 'missing_field', 'N/A')
        }
        return json.dumps(log_payload)

def setup_validation_logger():
    logger = logging.getLogger("telemetry_validator")
    logger.setLevel(logging.WARNING)
    
    handler = logging.StreamHandler()
    handler.setFormatter(TelemetryValidationFormatter())
    logger.addHandler(handler)
    return logger

validation_logger = setup_validation_logger()

def validate_event_payload(payload: dict):
    """Enforces tracking plan rules on incoming client-side telemetry."""
    required_fields = ['user_id', 'event_name', 'timestamp']
    for field in required_fields:
        if field not in payload or payload[field] is None:
            validation_logger.warning(
                f"Missing mandatory telemetry field", 
                extra={"event_type": payload.get("event_name", "UNKNOWN"), "missing_field": field}
            )`,
      },
    ],
  },
  {
    id: "part-2",
    title: "Part 2: Advanced Behavioral Analytics (The Core Core!)",
    sections: [
      {
        id: "sec-advanced-sessionization",
        title: "Advanced: Event Sessionization in SQL/Pandas",
        signal:
          "Many tracking tools don't send a session_id by default. You need to identify session boundaries by looking for inactivity gaps > 30 minutes. This is a common whiteboard interview question.",
        extraText: "Use Pandas shift() and cumulative sum (cumsum) to increment a session ID whenever the time difference between the current and previous event for a user exceeds 30 minutes.",
        code: `import pandas as pd
import numpy as np

def generate_session_ids(df: pd.DataFrame, timeout_minutes: int = 30) -> pd.DataFrame:
    """
    Advanced: Generates unique session IDs for users based on a 30-minute inactivity timeout.
    """
    df = df.copy()
    df['event_timestamp'] = pd.to_datetime(df['event_timestamp'])
    df = df.sort_values(['user_id', 'event_timestamp'])
    
    # Calculate time difference between consecutive events per user
    df['time_diff'] = df.groupby('user_id')['event_timestamp'].diff()
    
    # Flag events that start a new session (first event, or gap > timeout)
    timeout_delta = pd.Timedelta(minutes=timeout_minutes)
    df['is_new_session'] = (df['time_diff'].isnull()) | (df['time_diff'] > timeout_delta)
    
    # Cumulative sum creates a unique incrementing integer for each session per user
    df['session_idx'] = df.groupby('user_id')['is_new_session'].cumsum()
    
    # Concatenate user_id and session_idx to create a globally unique session_id
    df['session_id'] = df['user_id'].astype(str) + '-' + df['session_idx'].astype(str)
    
    return df`
      },
      {
        id: "sec-5",
        title: "5. Cohort Retention Matrix & Conversion Funnels (Pandas Mastery)",
        signal:
          "Writing vector-based calculations in Pandas without relying on performance-killing loops. Cohort analysis (tracking user engagement over months) and conversion funnels are highly prioritized in behavioral interviews.",
        extraText: "First, take a look at the classic visual output of this cohort retention calculation. The resulting matrix shows the gradual decline of active cohorts over time. Here is how you compute this exact matrix programmatically in Pandas:",
        code: `import pandas as pd

def calculate_cohort_retention(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes a Month-over-Month cohort retention matrix.
    Input df requires columns: 'user_id', 'event_timestamp'
    """
    df = df.copy()
    # 1. Standardize timestamps to months
    df['event_month'] = pd.to_datetime(df['event_timestamp']).dt.to_period('M')
    
    # 2. Determine the Cohort Month (first active month of the user)
    df['cohort_month'] = df.groupby('user_id')['event_month'].transform('min')
    
    # 3. Group and count unique users per cohort month and subsequent active month
    cohort_counts = df.groupby(['cohort_month', 'event_month']).agg(unique_users=('user_id', 'nunique')).reset_index()
    
    # 4. Calculate Cohort Index (the age of the cohort in months, where Month 0 is their start month)
    cohort_counts['cohort_index'] = (cohort_counts['event_month'] - cohort_counts['cohort_month']).apply(lambda x: x.n)
    
    # 5. Pivot into the final matrix structure
    cohort_pivot = cohort_counts.pivot(index='cohort_month', columns='cohort_index', values='unique_users')
    
    # 6. Normalize to show percentages relative to the starting cohort size (Month 0)
    cohort_sizes = cohort_pivot.iloc[:, 0]
    retention_matrix = cohort_pivot.divide(cohort_sizes, axis=0)
    
    return retention_matrix

def calculate_funnel_conversion(df: pd.DataFrame, funnel_steps: list) -> pd.DataFrame:
    """
    Calculates step-by-step conversion rate for a defined order of product events.
    Expected 'funnel_steps': ['sign_up', 'view_item', 'add_to_cart', 'purchase']
    """
    conversion_rates = []
    previous_step_users = None
    
    for i, step in enumerate(funnel_steps):
        # Find unique users who triggered this specific step
        step_users = set(df[df['event_name'] == step]['user_id'])
        
        if i == 0:
            # First step represents the initial pool of users
            cohort_size = len(step_users)
            conversion_rates.append({"step": step, "users": cohort_size, "dropoff": 0.0, "step_conversion": 1.0})
            previous_step_users = step_users
        else:
            # Users must have completed the *previous* step to count in this step
            valid_users = step_users.intersection(previous_step_users)
            user_count = len(valid_users)
            
            step_conv = user_count / len(previous_step_users) if len(previous_step_users) > 0 else 0.0
            dropoff = 1.0 - step_conv
            
            conversion_rates.append({
                "step": step, 
                "users": user_count, 
                "dropoff": dropoff, 
                "step_conversion": step_conv
            })
            previous_step_users = valid_users
            
    return pd.DataFrame(conversion_rates)`,
      },
      {
        id: "sec-6",
        title: "6. Concurrent Calculation for Mass Metrics Generation",
        signal:
          "Product managers often need metric reports calculated dynamically across dozens of distinct categories, geographies, or business units. Parallelizing these analytical tasks using thread pools ensures fast runtime.",
        code: `import concurrent.futures
from typing import List, Dict

def compute_metrics_for_cohort(cohort_id: str) -> Dict[str, float]:
    """Calculates specific revenue and engagement KPIs for a customer cohort."""
    # Imagine query execution and dataframe wrangling here
    # Mock result returned:
    return {"cohort_id": cohort_id, "arpu": 15.50, "churn_rate": 0.04}

def parallel_cohort_reporting(cohort_ids: List[str], max_threads: int = 4) -> List[Dict]:
    """Runs multiple cohort metric calculations concurrently."""
    results = []
    
    # We use ThreadPoolExecutor to prevent long wait-times on multi-region analytics queries
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_threads) as executor:
        # executor.map preserves order and returns outputs as tasks complete
        for metric_set in executor.map(compute_metrics_for_cohort, cohort_ids):
            results.append(metric_set)
            
    return results`,
      },
    ],
  },
  {
    id: "part-3",
    title: "Part 3: Advanced Python & Architecture",
    sections: [
      {
        id: "sec-7",
        title: "7. OOP Metrics Engine (Pluggable Metric Calculators)",
        signal:
          "When building an enterprise analytics tool, avoid writing long, messy script configurations. Design a clean, pluggable Object-Oriented framework using Abstract Base Classes. This makes it incredibly easy to add new metric calculations without breaking existing code.",
        code: `from abc import ABC, abstractmethod
import pandas as pd

class MetricCalculator(ABC):
    """Abstract Base Class defining the blueprint for all metric calculations."""
    @abstractmethod
    def calculate(self, df: pd.DataFrame) -> float:
        pass

class LTVCalculator(MetricCalculator):
    """Computes Lifetime Value (LTV): (Average Order Value) * (Purchase Frequency)."""
    def calculate(self, df: pd.DataFrame) -> float:
        if df.empty:
            return 0.0
        total_revenue = df[df['event_name'] == 'purchase']['amount'].sum()
        unique_buyers = df[df['event_name'] == 'purchase']['user_id'].nunique()
        if unique_buyers == 0:
            return 0.0
        return float(total_revenue / unique_buyers)

class ChurnCalculator(MetricCalculator):
    """Computes Churn Rate (Percentage of inactive users over a threshold)."""
    def calculate(self, df: pd.DataFrame) -> float:
        # Real-world logic would check activity thresholds; returning mock calculation
        total_users = df['user_id'].nunique()
        if total_users == 0:
            return 0.0
        inactive_users = df[df['is_active'] == False]['user_id'].nunique()
        return float(inactive_users / total_users)

# Factory to dynamically spin up standard metric calculators
def get_calculator(metric_name: str) -> MetricCalculator:
    registry = {
        "ltv": LTVCalculator(),
        "churn": ChurnCalculator()
    }
    if metric_name not in registry:
        raise ValueError(f"Metric '{metric_name}' is not supported yet.")
    return registry[metric_name]`,
      },
      {
        id: "sec-7-practice",
        title: "Practice: Building a DAU/MAU Ratio Calculator",
        signal:
          "DAU/MAU is a key stickiness metric. Add a new metric calculator to the OOP engine.",
        extraText: "Create a new calculator class extending MetricCalculator that calculates the ratio of Daily Active Users to Monthly Active Users (DAU/MAU stickiness).",
        code: `class StickinessCalculator(MetricCalculator):
    """Practice: Computes Stickiness (DAU/MAU)."""
    def calculate(self, df: pd.DataFrame) -> float:
        if df.empty:
            return 0.0
        
        # Ensure timestamp is datetime
        df['event_timestamp'] = pd.to_datetime(df['event_timestamp'])
        
        # Calculate MAU (unique users in period)
        mau = df['user_id'].nunique()
        if mau == 0:
            return 0.0
            
        # Calculate Average DAU
        df['activity_date'] = df['event_timestamp'].dt.date
        daily_users = df.groupby('activity_date')['user_id'].nunique()
        avg_dau = daily_users.mean()
        
        return float(avg_dau / mau)`
      },
      {
        id: "sec-8",
        title: "8. Memory-Safe Event Log Generators & Bootstrap Timers",
        signal:
          "Massive event log files can crash your system memory. Use Python Generators to parse log lines step-by-step. Also, use Decorators to measure calculation times during performance-heavy statistical scripts (such as running bootstrap sampling for A/B tests).",
        code: `import time
import json
from typing import Generator

# Timing decorator for performance tuning A/B test simulations
def log_execution_time(func):
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        duration = time.perf_counter() - start
        print(f"Analytics function '{func.__name__}' resolved in {duration:.4f}s")
        return result
    return wrapper

# Memory-safe event processing generator
def stream_clickstream_logs(file_path: str) -> Generator[dict, None, None]:
    """
    Yields single log dictionary events.
    Ensures memory-safety when parsing millions of tracking rows.
    """
    with open(file_path, 'r') as file:
        for line in file:
            if line.strip():
                yield json.loads(line)`,
      },
    ],
  },
  {
    id: "part-4",
    title: "Part 4: Testing & Mocking Analytics Telemetry",
    sections: [
      {
        id: "sec-9",
        title: "9. Pytest & Mocking Segment/Mixpanel Calls",
        signal:
          "Writing validation tests ensures product interactions trigger downstream tracking schemas correctly. Use mocking tools to simulate API triggers without sending fake data to your live dashboards during testing.",
        code: `import pytest
import requests
from unittest.mock import patch

def send_to_segment(user_id: str, event_name: str, properties: dict) -> int:
    """Fires telemetry updates to Segment API."""
    response = requests.post(
        "https://api.segment.io/v1/track",
        json={"userId": user_id, "event": event_name, "properties": properties},
        timeout=5
    )
    return response.status_code

# Mock out Segment's POST request to assert code functionality
@patch('requests.post')
def test_send_to_segment_success(mock_post):
    # Establish mock response metrics
    mock_post.return_value.status_code = 200
    
    status = send_to_segment("usr_99", "item_purchased", {"price": 29.99})
    
    assert status == 200
    mock_post.assert_called_once_with(
        "https://api.segment.io/v1/track",
        json={"userId": "usr_99", "event": "item_purchased", "properties": {"price": 29.99}},
        timeout=5
    )`,
      },
      {
        id: "sec-9-practice",
        title: "Practice: Mocking Exceptions",
        signal:
          "In interviews, they will check if you know how to mock Exceptions, not just successful responses. You need to verify your code behaves correctly when the API crashes.",
        extraText: "Write a test that mocks requests.post to raise a requests.exceptions.Timeout, and asserts your telemetry function handles it correctly without crashing the app.",
        code: `@patch('requests.post')
def test_send_to_segment_timeout(mock_post):
    """Practice: Test exception handling when API times out."""
    # Configure the mock to raise an exception instead of returning a response
    mock_post.side_effect = requests.exceptions.Timeout("Connection timed out")
    
    # Implement graceful fallback in the main function to pass this test
    # e.g., catch Timeout and return 504 status code
    try:
        status = send_to_segment("usr_99", "item_purchased", {"price": 29.99})
        assert False, "Should have handled the exception"
    except Exception as e:
        # In a real app, send_to_segment should catch and log this, returning an error state
        pass`
      }
    ],
  },
  {
    id: "part-5",
    title: "Part 5: Analytics Orchestration (Apache Airflow)",
    sections: [
      {
        id: "sec-10",
        title: "10. Daily KPI Aggregation Pipeline (TaskFlow API)",
        signal:
          "Orchestrating metrics calculation. Instead of passing massive raw telemetry tables between Airflow stages (which overloads XComs), extract raw logs inside S3, perform transformations, and write out consolidated metric tables.",
        code: `from airflow.decorators import dag, task
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

default_settings = {
    'owner': 'analytics_team',
    'retries': 2,
    'retry_delay': timedelta(minutes=10)
}

@dag(
    dag_id='daily_product_kpi_pipeline',
    default_args=default_settings,
    schedule_interval='@daily',
    start_date=datetime(2023, 1, 1),
    catchup=False, # Senior signal: Prevents running backfills concurrently
    tags=['product_reporting']
)
def analytics_kpi_dag():

    @task(multiple_outputs=True)
    def extract_and_store_s3() -> dict:
        """Saves daily clickstream logs and forwards path metadata."""
        target_s3_path = "s3://raw-events-prod/2023-10-15/raw.parquet"
        logger.info("Raw event file successfully written to S3 storage.")
        return {"file_path": target_s3_path, "total_records": 450000}

    @task
    def calculate_and_save_kpis(extract_meta: dict):
        """Calculates core funnel and cohort KPIs and updates downstream tables."""
        file_path = extract_meta["file_path"]
        logger.info(f"Loading raw telemetry data from {file_path}")
        # Run conversion funnel and active user calculations
        # pd.read_parquet(file_path) -> transform -> db_insert
        logger.info("Executive reporting dashboards successfully updated.")

    # Airflow evaluates functional parameters to resolve dependencies
    metadata = extract_and_store_s3()
    calculate_and_save_kpis(metadata)

# Instantiate the pipeline
dag_instance = analytics_kpi_dag()`,
      },
      {
        id: "sec-10-advanced",
        title: "Advanced: Idempotency with Jinja Templates",
        signal:
          "When doing historical backfills or re-running failed DAGs, you cannot simply append rows. You must DELETE old data for that partition date, or use MERGE statements.",
        extraText: "Airflow's execution date templates (like {{ ds }}) are powerful for building idempotent queries. Always parameterize your SQL templates.",
        code: `from airflow.providers.snowflake.operators.snowflake import SnowflakeOperator

# Advanced: Building an idempotent transform using execution dates
# {{ ds }} injects the logical execution date (YYYY-MM-DD)
idempotent_kpi_transform = SnowflakeOperator(
    task_id="calculate_daily_metrics",
    sql="""
        BEGIN;
        
        -- 1. Purge existing data for this execution date to prevent duplicates
        DELETE FROM analytics.daily_kpis 
        WHERE activity_date = '{{ ds }}';
        
        -- 2. Insert fresh calculations
        INSERT INTO analytics.daily_kpis (activity_date, total_revenue, active_users)
        SELECT 
            '{{ ds }}',
            SUM(amount),
            COUNT(DISTINCT user_id)
        FROM raw.events
        WHERE DATE(event_timestamp) = '{{ ds }}';
        
        COMMIT;
    """,
    snowflake_conn_id="snowflake_default"
)`
      }
    ],
  },
];

