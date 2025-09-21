using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace APS.Compartilhado.Modelos.Entidades;

/// <summary>
/// Entidade que representa um médico
/// </summary>
public class Medico
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [StringLength(100)]
    public string Nome { get; set; } = string.Empty;
    
    [Required]
    [StringLength(20)]
    public string CRM { get; set; } = string.Empty;
    
    [Required]
    [StringLength(2)]
    public string EstadoCRM { get; set; } = string.Empty;
    
    [Required]
    [StringLength(15)]
    public string CPF { get; set; } = string.Empty;
    
    [StringLength(100)]
    public string? Email { get; set; }
    
    [StringLength(20)]
    public string? Telefone { get; set; }
    
    [Required]
    [StringLength(100)]
    public string Especialidade { get; set; } = string.Empty;
    
    [StringLength(100)]
    public string? SubEspecialidade { get; set; }
    
    public DateTime DataFormatura { get; set; }
    
    public int AnosExperiencia { get; set; }
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal? SalarioBase { get; set; }
    
    public bool Ativo { get; set; } = true;
    
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    
    public DateTime? DataAtualizacao { get; set; }
    
    // Endereço residencial para cálculo de proximidade
    [StringLength(300)]
    public string? EnderecoResidencial { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? LatitudeResidencia { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? LongitudeResidencia { get; set; }
    
    // Chave estrangeira
    public int? MunicipioResidenciaId { get; set; }
    
    // Relacionamentos
    [ForeignKey("MunicipioResidenciaId")]
    public virtual Municipio? MunicipioResidencia { get; set; }
    
    public virtual ICollection<MedicoHospital> MedicosHospitais { get; set; } = new List<MedicoHospital>();
}
