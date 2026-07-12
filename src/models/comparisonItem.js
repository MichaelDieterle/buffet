module.exports = (sequelize, DataTypes) => {
  const ComparisonItem = sequelize.define('ComparisonItem', {
    weight: { type: DataTypes.FLOAT, defaultValue: 1.0 }, // weight in portfolio/comparison
    notes: DataTypes.TEXT,
  }, { timestamps: false });

  ComparisonItem.associate = (models) => {
    ComparisonItem.belongsTo(models.Stock, { foreignKey: 'stockId' });
    ComparisonItem.belongsTo(models.Comparison, { foreignKey: 'comparisonId' });
  };

  return ComparisonItem;
};
