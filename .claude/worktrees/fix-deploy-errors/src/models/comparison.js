module.exports = (sequelize, DataTypes) => {
  const Comparison = sequelize.define('Comparison', {
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
  }, { timestamps: true, underscored: true });

  Comparison.associate = (models) => {
    Comparison.belongsToMany(models.Stock, {
      through: models.ComparisonItem,
      foreignKey: 'comparisonId',
      otherKey: 'stockId',
      as: 'stocks',
    });
  };

  return Comparison;
};
