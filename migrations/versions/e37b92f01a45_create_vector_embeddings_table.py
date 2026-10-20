"""create_vector_embeddings_table

Revision ID: e37b92f01a45
Revises: cd2f8cd99387
Create Date: 2026-10-20 15:52:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e37b92f01a45'
down_revision: Union[str, Sequence[str], None] = 'cd2f8cd99387'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Create vector_embeddings table."""
    op.create_table(
        'vector_embeddings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('content_text', sa.Text(), nullable=False),
        sa.Column('sector', sa.String(length=100), nullable=True),
        sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('dimensions', sa.Integer(), nullable=False),
        sa.Column('embedding', postgresql.ARRAY(sa.Float()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_vector_embeddings'))
    )
    op.create_index(op.f('ix_vector_embeddings_entity_type'), 'vector_embeddings', ['entity_type'], unique=False)
    op.create_index(op.f('ix_vector_embeddings_entity_id'), 'vector_embeddings', ['entity_id'], unique=False)
    op.create_index(op.f('ix_vector_embeddings_sector'), 'vector_embeddings', ['sector'], unique=False)
    op.create_index(op.f('ix_vector_embeddings_created_at'), 'vector_embeddings', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema: Drop vector_embeddings table."""
    op.drop_index(op.f('ix_vector_embeddings_created_at'), table_name='vector_embeddings')
    op.drop_index(op.f('ix_vector_embeddings_sector'), table_name='vector_embeddings')
    op.drop_index(op.f('ix_vector_embeddings_entity_id'), table_name='vector_embeddings')
    op.drop_index(op.f('ix_vector_embeddings_entity_type'), table_name='vector_embeddings')
    op.drop_table('vector_embeddings')
