"""
RabbitMQ Topology Constants for Stratify AI.
Defines exchanges, queues, routing keys, and dead-letter configurations.
"""

# Exchanges
TASKS_EXCHANGE = "stratify.tasks.exchange"
DEAD_LETTER_EXCHANGE = "stratify.tasks.dlx"

# Queues
TASKS_QUEUE = "stratify.tasks.queue"
DEAD_LETTER_QUEUE = "stratify.tasks.dlq"

# Routing Keys
TASKS_ROUTING_KEY_PREFIX = "tasks"
TASKS_ROUTING_KEY_ALL = "tasks.*"
DEAD_LETTER_ROUTING_KEY = "tasks.dead"

# Headers
HEADER_RETRY_COUNT = "x-retry-count"
HEADER_TASK_ID = "x-task-id"
HEADER_JOB_ID = "x-job-id"
