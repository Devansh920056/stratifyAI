"""create_fused_evidence_table

Revision ID: b7102e84cf91
Revises: e37b92f01a45
Create Date: 2026-10-20 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b7102e84cf91'
down_revision: Union[str, Sequence[str], None] = 'e37b92f01a45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Create fused_evidence table."""
    op.create_table(
        'fused_evidence',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('entity_name', sa.String(length=150), nullable=False),
        sa.Column('source_type', sa.String(length=50), nullable=False),
        sa.Column('filing_type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('content_excerpt', sa.Text(), nullable=False),
        sa.Column('source_url', sa.Text(), nullable=False),
        sa.Column('reliability_score', sa.Float(), nullable=False),
        sa.Column('divergence_status', sa.String(length=30), nullable=False),
        sa.Column('reconciliation_notes', sa.Text(), nullable=True),
        sa.Column('fiscal_period', sa.String(length=50), nullable=True),
        sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_fused_evidence'))
    )
    op.create_index(op.f('ix_fused_evidence_entity_name'), 'fused_evidence', ['entity_name'], unique=False)
    op.create_index(op.f('ix_fused_evidence_source_type'), 'fused_evidence', ['source_type'], unique=False)
    op.create_index(op.f('ix_fused_evidence_filing_type'), 'fused_evidence', ['filing_type'], unique=False)
    op.create_index(op.f('ix_fused_evidence_divergence_status'), 'fused_evidence', ['divergence_status'], unique=False)
    op.create_index(op.f('ix_fused_evidence_created_at'), 'fused_evidence', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema: Drop fused_evidence table."""
    op.drop_index(op.f('ix_fused_evidence_created_at'), table_name='fused_evidence')
    op.drop_index(op.f('ix_fused_evidence_divergence_status'), table_name='fused_evidence')
    op.drop_index(op.f('ix_fused_evidence_filing_type'), table_name='fused_evidence')
    op.drop_index(op.f('ix_fused_evidence_source_type'), table_name='fused_evidence')
    op.drop_index(op.f('ix_fused_evidence_entity_name'), table_name='fused_evidence')
    op.drop_table('fused_evidence')
