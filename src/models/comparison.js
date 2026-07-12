module.exports = (sequelize, DataTypes) => {
  const Comparison = sequelize.define('Comparison', {
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
  }, { timestamps: true, underscored: true });

  Comparison.associate = (models) => {
    Comparison.belongsToMany(models.Stock, { through: 'ComparisonItem', foreignKey: 'comparisonId', otherKey: 'stockId' });
  };

  return Comparison;
};
