module.exports = (sequelize, DataTypes) => {
  const Competitor = sequelize.define('Competitor', {
    relationType: { type: DataTypes.STRING, defaultValue: 'peer' },
  }, { timestamps: false });

  Competitor.associate = (models) => {
    Competitor.belongsTo(models.Stock, { foreignKey: 'stockId', as: 'stock' });
    Competitor.belongsTo(models.Stock, { foreignKey: 'competitorId', as: 'competitorStock' });
  };

  return Competitor;
};
