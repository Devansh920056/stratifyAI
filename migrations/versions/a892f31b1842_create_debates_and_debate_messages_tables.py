"""create_debates_and_debate_messages_tables

Revision ID: a892f31b1842
Revises: b7102e84cf91
Create Date: 2026-10-20 16:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a892f31b1842'
down_revision: Union[str, Sequence[str], None] = 'b7102e84cf91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Create debates and debate_messages tables."""
    # 1. debates table
    op.create_table(
        'debates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('topic', sa.String(length=300), nullable=False),
        sa.Column('entity_name', sa.String(length=150), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('rounds_count', sa.Integer(), nullable=False),
        sa.Column('arbiter_verdict', sa.String(length=50), nullable=True),
        sa.Column('conviction_score', sa.Float(), nullable=True),
        sa.Column('executive_summary', sa.Text(), nullable=True),
        sa.Column('synthesis_matrix', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_debates'))
    )
    op.create_index(op.f('ix_debates_entity_name'), 'debates', ['entity_name'], unique=False)
    op.create_index(op.f('ix_debates_status'), 'debates', ['status'], unique=False)
    op.create_index(op.f('ix_debates_created_at'), 'debates', ['created_at'], unique=False)

    # 2. debate_messages table
    op.create_table(
        'debate_messages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('debate_id', sa.UUID(), nullable=False),
        sa.Column('agent_role', sa.String(length=50), nullable=False),
        sa.Column('agent_name', sa.String(length=150), nullable=False),
        sa.Column('round_number', sa.Integer(), nullable=False),
        sa.Column('argument_type', sa.String(length=50), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('evidence_citations', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['debate_id'], ['debates.id'], name=op.f('fk_debate_messages_debate_id_debates'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_debate_messages'))
    )
    op.create_index(op.f('ix_debate_messages_debate_id'), 'debate_messages', ['debate_id'], unique=False)
    op.create_index(op.f('ix_debate_messages_agent_role'), 'debate_messages', ['agent_role'], unique=False)
    op.create_index(op.f('ix_debate_messages_round_number'), 'debate_messages', ['round_number'], unique=False)


def downgrade() -> None:
    """Downgrade schema: Drop debate_messages and debates tables."""
    op.drop_index(op.f('ix_debate_messages_round_number'), table_name='debate_messages')
    op.drop_index(op.f('ix_debate_messages_agent_role'), table_name='debate_messages')
    op.drop_index(op.f('ix_debate_messages_debate_id'), table_name='debate_messages')
    op.drop_table('debate_messages')

    op.drop_index(op.f('ix_debates_created_at'), table_name='debates')
    op.drop_index(op.f('ix_debates_status'), table_name='debates')
    op.drop_index(op.f('ix_debates_entity_name'), table_name='debates')
    op.drop_table('debates')
