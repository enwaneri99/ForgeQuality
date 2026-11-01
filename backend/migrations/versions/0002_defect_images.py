"""Store defect photos."""
from alembic import op
from sqlalchemy import inspect
import sqlalchemy as sa

revision = "0002_defect_images"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    if "defect_images" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "defect_images",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("defect_id", sa.Integer(), sa.ForeignKey("defects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("file_name", sa.String(length=255), nullable=False),
            sa.Column("media_type", sa.String(length=100), nullable=False),
            sa.Column("file_size", sa.Integer(), nullable=False),
            sa.Column("image_data", sa.LargeBinary(), nullable=False),
            sa.Column("preview_data", sa.LargeBinary(), nullable=False),
            sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_defect_images_defect_id", "defect_images", ["defect_id"])


def downgrade():
    if "defect_images" in inspect(op.get_bind()).get_table_names():
        op.drop_index("ix_defect_images_defect_id", table_name="defect_images")
        op.drop_table("defect_images")
